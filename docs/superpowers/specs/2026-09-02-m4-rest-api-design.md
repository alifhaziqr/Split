# M4 — REST API design record

*Written 2026-09-02, after M4 landed. This is a record of what was built, not a
pre-implementation brainstorm — see `2026-09-01-split-design.md` for that document's style
and errata convention, which this one follows.*

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/groups` | create a group |
| GET | `/api/groups` | list groups |
| GET | `/api/groups/:groupId` | group details (members + expenses) |
| DELETE | `/api/groups/:groupId` | delete an empty group |
| POST | `/api/groups/:groupId/members` | add a member |
| DELETE | `/api/groups/:groupId/members/:memberId` | remove a member |
| POST | `/api/groups/:groupId/expenses` | record an expense |
| DELETE | `/api/expenses/:expenseId` | delete an expense (not group-nested — an id alone is enough) |
| GET | `/api/groups/:groupId/settlement` | balances + simplified transfers |

Nine endpoints total.

## Status-code mapping

`src/server/api/errors.ts`'s `toErrorResponse` is the single place any thrown error becomes
an HTTP status and JSON body. Codes are hard-coded string literals, never derived from
`error.name`, so renaming a class can't silently change the wire contract.

| Status | Trigger |
|---|---|
| 400 | malformed JSON; zod `ZodError` (request structure) |
| 404 | `GroupNotFoundError`, `MemberNotFoundError`, `ExpenseNotFoundError` |
| 409 | `DuplicateMemberError`, `MemberReferencedError`, `GroupNotEmptyError` |
| 422 | `ValidationError` (bad caller input core rejected), `MemberNotInGroupError` |
| 500 | anything else — includes `core/settle.ts`'s plain Errors for corrupted stored data, and `money.ts`'s `unreachable:` guard |

The 500 body never includes the original error's `.message` or `.stack` (file paths, row
ids, raw SQL could leak); the real error is still `console.error`'d server-side.

## File layout (`src/server/`)

    api/
      dto.ts               storage row -> wire DTO (sorts members/expenses/shares deterministically)
      errors.ts            the status-code mapping table above
      schemas.ts           zod request-structure validation
      routes/
        shared.ts           requireGroupExists, requireParam
        groups.ts            POST/GET/GET/DELETE /api/groups...
        members.ts            POST/DELETE .../members...
        expenses.ts            POST .../expenses, DELETE /api/expenses/:id
        settlement.ts           GET .../settlement
    db/                     unchanged M3 layout (client.ts, groups.ts, members.ts,
                            expenses.ts, prismaErrors.ts) plus three new functions below
    app.ts                 composes routes onto one Hono app + app.onError/app.notFound;
                            never imports '@hono/node-server'
    index.ts                the only file that does — serve(), port, DATABASE_URL check
    settlement.ts           storage-to-core adapter (GroupDetails -> core/settle.ts)

## Key decisions

**Error taxonomy.** `core/errors.ts` gained `ValidationError` for caller-input faults (422).
`core/settle.ts`'s re-checks of data read back from storage, and `money.ts`'s internal
`unreachable:` guard, stay plain `Error` on purpose — neither describes something the HTTP
caller did wrong, so both fall through to 500.

**zod / core boundary.** zod owns structure (types, presence, numeric ranges, unknown-key
rejection via `strictObject`). Core owns cross-field arithmetic — a PERCENT split's basis
points summing to 10000, an EXACT split's cents summing to the expense total. zod
deliberately lets an unbalanced split parse; `splitAmount` is trusted to reject it, so the
rule lives in exactly one place.

**DTO ordering.** `toGroupDetailsDto` sorts members by (name, id) and expenses by (date
desc, id), both with an explicit id tiebreaker — SQLite's `createdAt` column only has
whole-second resolution, so rows created within the same request can tie without it.

**Route-layer pre-checks.** `requireGroupExists` runs before any other `db/*` call on a
`:groupId` route: without it, a bogus id on expense creation would surface a confusing
"member not in group" error instead of a clean 404. Member deletion additionally scopes its
lookup to `(memberId, groupId)` before deleting, because `deleteMember` only knows a member
id — a member-deletion URL scoped to the wrong group would otherwise still succeed.

**Three new database functions.**

| Function | Delete semantics |
|---|---|
| `listGroups` | read-only; ordered `(createdAt desc, id asc)` for a stable, repeatable list |
| `deleteGroup` | deletes one group row; fails with `GroupNotEmptyError` if `ON DELETE RESTRICT` rejects it (members or expenses still reference it), `GroupNotFoundError` on Prisma `P2025` |
| `deleteExpense` | transactionally deletes the expense's `ExpenseShare` rows first, then the `Expense` row itself; `P2025` from the transaction means the expense never existed |

## Verification

`tests/server/api/endToEnd.test.ts` is this milestone's own check against
`2026-09-01-split-design.md`'s pre-committed acceptance criteria: driven entirely through
the real HTTP surface (`app.request`) against a real migrated temp SQLite database, it seeds
a group of four with five mixed-mode expenses, applies the settle-up transfers by hand, and
confirms every balance zeroes — plus the design doc's two named hard cases (a 100-cent
three-way split, and an expense whose payer isn't among its own participants).
