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
- **Next: M1** — `core/money.ts` and `core/split.ts`, test-first.
