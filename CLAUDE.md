# Split

Expense-sharing app (Splitwise-lite). Groups, members, expenses with four split modes,
and a settle-up view that reduces who-owes-whom to a short list of payments (greedy,
at most n-1 — see Conventions settled in M2, not a proven minimum).

This is a learning project. Good practice matters more than speed.

## Commands

First run only:

    cp .env.example .env   # DATABASE_URL for a persistent local dev.db;
                            # `npm install` works without this too — see M3
    npx prisma migrate deploy  # a truly fresh clone has no dev.db yet;
                                # `npm run dev` needs this run once first

    npm test           # vitest, single run
    npm run test:watch # vitest, watch mode
    npm run typecheck  # tsc --noEmit
    npm run dev        # tsx-watched Hono dev server (src/server/index.ts)

`npm install` runs `prisma generate` via `postinstall` — required before `src/generated/prisma`
exists at all. Node 24 required (see `.nvmrc`). If versions look wrong, run `nvm use`.

## Architecture — the dependency rule

    src/core    Pure TypeScript. Imports nothing from outside src/core.
                No I/O, no database, no HTTP, no framework.
    src/server  Hono API (src/server/api) + Prisma/SQLite (src/server/db). May
                import core. Never imports web.
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
  written test-first. 54 tests. The design doc's pre-implementation sketch,
  `splitAmount(amountCents, mode, participants)`, settled as the two-argument
  `splitAmount(amountCents, input: SplitInput)` — mode and participants fused into one
  discriminated union, so an illegal mode/participant pairing is unrepresentable.
- **M2 done** — `core/settle.ts`: `computeBalances` and `simplifyDebts`, test-first, then a
  `/code-review` pass whose findings were fixed test-first too. 79 tests.
- **M3 done** — Prisma schema + migration, `server/db` repository functions
  (`groups`, `members`, `expenses`), test-first against a real migrated SQLite file, then a
  `/code-review` pass whose findings were verified and fixed test-first too. 100 tests.
- **M4 done** — a 9-endpoint Hono REST API under `src/server/api` (`schemas.ts` for zod
  request validation, `dto.ts` for response shaping, `errors.ts` for the one status-code
  mapping table, `routes/{groups,members,expenses,settlement}.ts`, composed onto one app in
  `server/app.ts`, served by `server/index.ts`), plus `server/settlement.ts` — the
  storage-to-core adapter mapping `GroupDetails` to `ExpenseRecord[]`, `core/settle.ts`'s
  first production caller. `core/errors.ts` gained `ValidationError`, mapped to HTTP 422.
  Test-first, then a `/code-review` pass whose findings were verified and fixed test-first
  too, then the design doc's own named end-to-end verification
  (`tests/server/api/endToEnd.test.ts`: a seeded group of four, five mixed-mode expenses,
  settle-up transfers applied by hand and confirmed to zero every balance). 209 tests.
- **Next: M5** — `src/web` still exists only as an empty scaffold directory, so M5 is
  presumably the React web client; scope beyond that is not yet decided.

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
from `splitAmount`, so `computeBalances` re-checks integer cents, a non-negative amount, and
the shares-sum itself, rather than assuming storage already enforced them. It does *not*
currently re-check that each individual `shareCents` is non-negative — the write path
enforces that in four places (`split.ts`, `allocate`) and the schema does not enforce it at
all, so a hand-edited or corrupted row could still slip a negative share past this boundary.
Narrow gap, not a live bug; worth a guard if `computeBalances` ever gains other untrusted
callers.

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
found by deleting the directory and running `npm test`. That first check left the developer's
own `.env` in place, though, and `.env` is *also* gitignored (only `.env.example` is
committed) — so it didn't actually prove a from-scratch clone works. A true clean clone
(`git archive HEAD` into an empty directory) failed: `prisma.config.ts` read
`env('DATABASE_URL')`, which throws when unset, so `postinstall` itself failed before
`src/generated` could be produced. Fixed by giving `prisma.config.ts` a
`process.env.DATABASE_URL ?? 'file:./dev.db'` fallback — dotenv never overwrites an
already-set variable, so an explicit `DATABASE_URL` (tests pass their own) still wins.
Verified against a real clean clone with no `.env` present: `npm install && npm test` is
green.

**The DB suite's cost is real and now budgeted for.** Each of the three
`tests/server/db/*.test.ts` files spawns a real `prisma migrate deploy` subprocess in
`beforeAll` — multiple seconds each, three times per run. Vitest's 10s default `hookTimeout`
is tight enough to fail all three suites at once on a loaded machine; `vitest.config.ts` sets
`hookTimeout: 60_000` to give the migration room.

**A `.rejects.toThrow(SomeClass)` test can pass for the wrong reason.** If `SomeClass` isn't
actually exported yet, the import silently resolves to `undefined` under Vitest's transform,
and `toThrow(undefined)` matches *any* thrown error — so the test is green before the feature
exists. Caught by mutation: after making a test pass, temporarily revert the implementation
and confirm the test fails again before trusting it.

## Conventions settled in M4

**Not every thrown error is a `ValidationError`.** `core/errors.ts`'s `ValidationError` is
for a fault in what the *caller* supplied — a bad amount, an unbalanced split — and the API
maps it to 422. `core/settle.ts`'s own throws describe corrupted *stored* data reached from a
request that only carried a group id, not the caller's fault, so they were deliberately left
as plain, un-subclassed Errors and map to 500 instead. `money.ts`'s internal `unreachable:`
invariant guard stays a plain Error for the identical reason: a triggered guard means the
allocator itself is broken, not that the caller's input was bad.

**zod owns request structure; core owns cross-field arithmetic.** `src/server/api/schemas.ts`
validates types, presence, and numeric ranges — it deliberately lets an arithmetically
unbalanced PERCENT split (basis points not summing to 10000) parse successfully, trusting
`splitAmount` to reject it. Duplicating that rule at the zod layer would give the two layers
two independent copies of the same check that could silently drift apart.

**Two checks exist at the route layer precisely because the `db/*` functions beneath them
don't (and shouldn't) make them.** A bogus `groupId` on an expense-creation request would
otherwise surface as a confusing "member not in group" error — `createExpense`'s member
lookup just returns no rows for a nonexistent group — so `requireGroupExists`
(`routes/shared.ts`) checks the group first and throws a clean `GroupNotFoundError`. Separately, a
member-deletion URL scoped to the *wrong* group would otherwise still succeed: `deleteMember`
only knows a memberId, not which group's URL reached it. `routes/members.ts` scopes the
lookup to `(memberId, groupId)` before deleting.

**`tests/server/api/routes.test.ts` is one file with four `describe` blocks, not four
files.** Each `tests/server/*.test.ts` file spawns its own real `prisma migrate deploy`
subprocess in `beforeAll` (see `testDb.ts`), so one file covering groups, members, expenses,
and settlement routes costs one migration instead of four. The next optimization down this
path — a vitest `globalSetup` that runs the migration exactly once into a template SQLite
file each test file then cheaply copies, cutting every suite's migration cost to one
regardless of file count — is deliberately not done this milestone: it would require
rewriting `tests/server/db/testDb.test.ts`'s own tests, which currently assert specifically
on `testDb.ts`'s real subprocess-spawning behavior.

**`vitest.config.ts` sets `fileParallelism: false`.** Five files now spawn a real `prisma
migrate deploy` subprocess in `beforeAll`; running all five at once (vitest's default) starves
them under load — confirmed by running the suite repeatedly with parallelism on: some runs
passed, some failed several suites at once on the same 60s `hookTimeout`, which is resource
contention, not an insufficient timeout. Serializing test files trades wall-clock time (the
suite now takes tens of seconds longer) for a suite that passes every time — this repo already
accepts that tradeoff for correctness (see the migration cost itself), and the real fix is the
same deferred `globalSetup` template-copy optimization named above, which would remove the
contention at its source instead of just avoiding it.

**A caught error's own `.message` never reaches the client, even for `SyntaxError`.**
`errors.ts`'s generic 500 branch was already careful not to echo an unrecognized error's
message; the `SyntaxError` branch (malformed JSON bodies) initially wasn't, on the reasoning
that `JSON.parse`'s own error messages only describe a token and position, never echo
back the input. That's true for *today's* one call site, but `toErrorResponse` can't tell a
`SyntaxError` raised while parsing a request body apart from one raised anywhere else in the
codebase for an unrelated reason — so it now returns a fixed message, matching the same
no-leak guarantee as the generic 500 branch, rather than depending on that current call site
never changing.

**Every `:groupId`-scoped route checks the group exists — except `DELETE /api/groups/:groupId`
itself, which doesn't need to.** `deleteGroup` already turns a missing group into
`GroupNotFoundError` on its own (a Prisma `P2025` from the delete), so a `requireGroupExists`
pre-check there would only add a redundant `SELECT` ahead of the `DELETE`. The member-deletion
route needs its own explicit `requireGroupExists` call, though, precisely because its
group-scoping check (see above) can't distinguish "this group doesn't exist" from "this member
doesn't belong to this group" — both look identical to a `findFirst({ id: memberId, groupId
})` that returns null, so without the separate check a nonexistent group is misreported as
`MEMBER_NOT_FOUND` instead of `GROUP_NOT_FOUND`.

**Cheap, in-memory body validation runs before any group-existence database query**, in both
`POST /api/groups/:groupId/members` and `POST /api/groups/:groupId/expenses` — a malformed
request body is rejected the same way whether or not the `groupId` in the URL happens to be
real, so there's no reason to pay for a `SELECT` before the schema check that would have
rejected it for free.
