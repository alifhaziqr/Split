# Split — design

*Written 2026-09-01, from a brainstorming pass. Committed before implementation began.*

*Errata (2026-09-02, after M1-M3): "shortest"/"minimal" below describes intent, not the
settled algorithm — `simplifyDebts` is a greedy heuristic bounded by n-1 payments, not a
proven minimum (see the Core algorithm section below, and CLAUDE.md). `splitAmount`'s real
signature is `splitAmount(amountCents, input: SplitInput)`, with `mode` and `participants`
fused into one discriminated union. This document is left otherwise unchanged as the
historical record it was committed as.*

## Problem

Groups of people share costs unevenly. Working out who owes whom by hand is tedious and
error-prone, and naive approaches produce more payments than necessary.

## Scope

Create a group, add members by name, record expenses with one of four split modes, and see
both each member's net balance and the shortest list of payments that settles the group.

**Explicitly out of scope:** user accounts, passwords, sessions, multi-currency conversion,
payment processing, recurring expenses, receipt uploads.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Authentication | None; members are records in a group | Boilerplate with low learning value here |
| Storage | SQLite via Prisma | Single file, zero setup, real migrations |
| Money | Integer cents | Floats cannot represent money correctly |
| Layers | core / server / web, one-way dependencies | Makes the algorithm testable in isolation |
| Shares | Materialised at write time | Historical expenses must not shift if rules change |

## Data model

- **Group** — id, name, currency, createdAt
- **Member** — id, groupId, name (unique within a group)
- **Expense** — id, groupId, description, amountCents, paidByMemberId, date, splitMode, createdAt
- **ExpenseShare** — id, expenseId, memberId, shareCents

`splitMode` is one of `EQUAL`, `EXACT`, `PERCENT`, `SHARES`.

## Core algorithm

Three pure functions in `src/core`, each defined by its invariants.

**`splitAmount(amountCents, mode, participants)`**
Returns each participant's owed cents. Invariant: the returned values sum to exactly
`amountCents`. Leftover cents from indivisible amounts go to participants in order of
largest fractional remainder, ties broken by member id.

**`computeBalances(expenses)`**
Returns each member's net position: total paid minus total owed. Invariant: balances sum
to exactly zero across the group. A non-zero sum indicates a bug upstream.

**`simplifyDebts(balances)`**
Greedily matches the largest creditor against the largest debtor until all balances are
zero. Invariants: applying every returned transfer zeroes all balances; the result contains
at most n-1 transfers; no member both pays and receives.

## Known hard cases

These drive the tests, not the implementation:

- 100 cents split three ways — must be 34/33/33, never 33/33/33
- A single participant — receives the whole amount
- An expense whose payer is not among the participants
- Percentages that do not sum to 100 — rejected at the edge
- A group already settled — produces zero transfers

## Verification

`npm test` green and `npm run typecheck` clean at every milestone. The end-to-end check is
a seeded group of four with five mixed-mode expenses, where the settle-up transfers are
applied by hand and confirmed to zero every balance.
