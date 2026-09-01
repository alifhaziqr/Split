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

    src/core    Pure TypeScript. Imports NOTHING from this project.
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
- **Next: M3** — Prisma schema, migration, `server/db` repository functions.

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
