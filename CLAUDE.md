# Split

Expense-sharing app (Splitwise-lite). Groups, members, expenses with four split modes,
and a settle-up view that computes the minimal set of payments to square everyone up.

This is a learning project. Good practice matters more than speed.

## Commands

    npm test           # vitest, single run
    npm run test:watch # vitest, watch mode
    npm run typecheck  # tsc --noEmit

Node 24 required (see `.nvmrc`). If versions look wrong, run `nvm use`.

## Architecture — the dependency rule

    src/core    Pure TypeScript. Imports nothing from outside src/core.
                No I/O, no database, no HTTP, no framework.
    src/server  Hono API + Prisma/SQLite. May import core. Never imports web.
    src/web     React + Vite. Imports neither. Talks to the server over HTTP only.

If a change wants to break this rule, stop and reconsider the design. This rule is the
reason the settlement algorithm can be tested with no browser and no database present.

## Money

Always integer cents — `amountCents`, `shareCents`. Never floats. Never dollars.

Every split must satisfy `sum(shares) === amountCents` exactly. Leftover cents are
distributed by the largest-remainder method, ties broken by member id, so results are
deterministic and reproducible.

## Testing

Tests live in `tests/`, mirroring `src/`. For `src/core`, tests are written *before* the
implementation. Prefer invariant tests — balances sum to zero, shares sum to the total —
over example-by-example assertions.

## Status

- **M0 done** — scaffold, git, TypeScript strict, Vitest.
- **M1 done** — `core/money.ts` (parse, format, `allocate`) and `core/split.ts` (four modes),
  written test-first. 54 tests.
- **M2 done** — `core/settle.ts`: `computeBalances` and `simplifyDebts`, test-first, then a
  `/code-review` pass whose findings were fixed test-first too. 79 tests.
- **M3 done** — Prisma schema + migration, `server/db` repository functions
  (`groups`, `members`, `expenses`), test-first against a real migrated SQLite file, then a
  `/code-review` pass whose findings were verified and fixed test-first too. 100 tests.
- **Next: M4** — Hono REST API, zod validation, error handling, API tests.

## Conventions settled in M1

Percentages are **integer basis points** (`percentBp`, summing to 10000), not float percents —
33.33% is 3333. Same reason as cents: a percentage that cannot be represented exactly puts a
float back on the path to a stored share.

`allocate(totalCents, weights)` in `money.ts` is the single place the largest-remainder rule
lives. EQUAL, PERCENT and SHARES are all weighted allocations that delegate to it; only EXACT
bypasses it, because the caller supplies the cents and we merely verify they sum.

## Conventions settled in M2

`simplifyDebts` is a **greedy heuristic, not a minimum**. It re-selects the largest creditor
and largest debtor after *every* payment — sorting once and walking the lists is a different,
worse algorithm that costs an avoidable extra payment in ~7% of groups. It guarantees at most
`n-1` payments and that nobody both pays and receives; the true minimum is NP-hard and not
worth chasing.

**Core functions validate their own inputs.** `ExpenseRecord` arrives from the database, not
from `splitAmount`, so `computeBalances` re-checks integer cents and the shares-sum itself.
Core is where the money rules are enforced, not merely assumed.

## Conventions settled in M3

**Prisma 7 dropped `datasource.url` from schema.prisma.** The connection URL now lives in
`prisma.config.ts` (for `migrate`/`generate`), and `PrismaClient` connects at runtime via a
driver adapter — we use `@prisma/adapter-better-sqlite3`, passed a URL in `createDbClient`
(`src/server/db/client.ts`). This is what lets tests point each run at its own temp SQLite
file instead of sharing one. `prisma.config.ts` needs `import 'dotenv/config'` itself —
Prisma no longer loads `.env` for you.

**Member deletion relies on the database, not a pre-check.** The migration leaves
`ON DELETE RESTRICT` on every foreign key into `Member` (Prisma's default). `deleteMember`
just attempts the delete and catches SQLite's constraint violation (Prisma error `P2003`),
turning it into `MemberReferencedError`. No read-then-delete race.

**Repository functions validate before writing.** `createExpense` calls `core/split.ts`
before touching the database, so an invalid split throws with nothing persisted — the same
"validate at the boundary, not after" rule as `computeBalances` in M2, one layer further out.

**DB tests run the real migration.** `tests/server/db/testDb.ts` creates a temp SQLite file
per test file and runs the actual `prisma migrate deploy` against it, so tests prove the
committed migration works — not a schema assembled ad hoc for testing.

**Foreign keys only prove a row exists, not that it belongs here.** `createExpense` checks
that `paidByMemberId` and every split participant belong to the target group *before*
writing — the FK to `Member` is satisfied by a member of any group, so a stale cross-group
id would otherwise write silently and corrupt both groups' balances.

**SQLite reports every FK violation as the same generic Prisma code (`P2003`).** The
driver's own `originalCode` disambiguates: `SQLITE_CONSTRAINT_FOREIGNKEY` means the
referenced row doesn't exist (insert against a missing group/member), while
`SQLITE_CONSTRAINT_TRIGGER` means an `ON DELETE RESTRICT` trigger fired (the row you're
deleting is still referenced). Verified against the adapter's real error shape before
relying on it — see `foreignKeyViolationKind` in `server/db/members.ts`. Same caution
applies to `P2002`: check `error.meta`'s constraint fields, not just the bare code, since a
second unique constraint later would otherwise get mislabeled.

**`prisma generate` must run on install**, not just once by hand. `src/generated/prisma` is
gitignored, so a fresh clone has nothing until `postinstall` in `package.json` runs it —
found by literally deleting the directory and running `npm test` to confirm CLAUDE.md's own
documented Commands actually work from a clean checkout.

**A `.rejects.toThrow(SomeClass)` test can pass for the wrong reason.** If `SomeClass` isn't
actually exported yet, the import silently resolves to `undefined` under Vitest's transform,
and `toThrow(undefined)` matches *any* thrown error — so the test is green before the feature
exists. Caught by mutation: after making a test pass, temporarily revert the implementation
and confirm the test fails again before trusting it.
