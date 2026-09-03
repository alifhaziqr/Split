# Split

Expense-sharing app (Splitwise-lite). Groups, members, expenses with four split modes,
and a settle-up view that reduces who-owes-whom to a short list of payments (greedy
heuristic, at most n-1 payments — see Money below, not a proven minimum).

This is a learning project. Good practice matters more than speed.

## Commands

First run only:

    cp .env.example .env   # DATABASE_URL for a persistent local dev.db;
                            # `npm install` works without this too — see Database
    npx prisma migrate deploy  # a truly fresh clone has no dev.db yet;
                                # `npm run dev` needs this run once first

    npm test           # vitest, single run
    npm run test:watch # vitest, watch mode
    npm run lint        # biome check --error-on-warnings (lint + format check)
    npm run lint:fix    # biome check --write (safe autofixes + reformat)
    npm run typecheck  # tsc --noEmit
    npm run dev        # tsx-watched Hono dev server (src/server/index.ts)
    npm run dev:web     # Vite dev server for the React client (src/web), proxies /api to :3000
    npm run build:web   # typecheck, then vite build (src/web -> dist/web)
    npm run preview:web # serves the build:web output locally

`npm install` runs `prisma generate` via `postinstall` — required before `src/generated/prisma`
exists at all. Node 24 required (see `.nvmrc`). If versions look wrong, run `nvm use`.

For local dev with the web client, run `npm run dev` and `npm run dev:web` in two terminals and
open **http://localhost:5173** — never open :3000 directly, it serves JSON only.

## Architecture — the dependency rule

    src/core    Pure TypeScript. Imports nothing from outside src/core.
                No I/O, no database, no HTTP, no framework.
    src/server  Hono API (src/server/api) + Prisma/SQLite (src/server/db). May
                import core. Never imports web.
    src/web     React + Vite. Never imports src/server — not even a type.
                May import src/core inward, but only core/money.ts and
                core/split.ts: types freely, runtime only for input parsing,
                display formatting, and a read-only preview. Never imports
                core/settle.ts — balances and transfers come from the
                server, the only authority on what a group owes. Talks to
                the server over HTTP only.

If a change wants to break this rule, stop and reconsider the design. This rule is the
reason the settlement algorithm can be tested with no browser and no database present.
`tests/core/dependencyRule.test.ts` enforces it by resolving every relative import against
its own file's directory, not by matching substrings — a comment mentioning `core/settle`
can't fool it.

## Money

Always integer cents — `amountCents`, `shareCents`. Never floats. Never dollars. Percentages
are **integer basis points** (`percentBp`, summing to 10000), not float percents — 33.33% is
3333 — for the same reason: a value that can't be represented exactly puts a float back on the
path to a stored share.

Every split must satisfy `sum(shares) === amountCents` exactly. Leftover cents are distributed
by the largest-remainder method, ties broken by member id, so results are deterministic and
reproducible. `allocate(totalCents, weights)` in `core/money.ts` is the single place that rule
lives — EQUAL, PERCENT, and SHARES are all weighted allocations that delegate to it; only EXACT
bypasses it, because the caller supplies the cents and it merely verifies they sum.

`simplifyDebts` (`core/settle.ts`) is a **greedy heuristic, not a minimum**: it re-selects the
largest creditor and largest debtor after *every* payment. Sorting once and walking the lists is
a different, worse algorithm — it costs an avoidable extra payment in ~7% of groups. Guarantees
at most `n-1` payments and that nobody both pays and receives; the true minimum is NP-hard and
not worth chasing.

Every money display goes through `formatCents` — usually via the `Money` component — never
`(cents / 100).toFixed(2)`, even in a client-side preview with no arithmetic feeding back into
storage. This is enforced for consistency with the stated rule above, not because a divergent
value has actually been reproduced (V8's `toFixed` happens to round correctly across the
practical cents range).

## Boundaries

**Validate at the boundary, not after — applied at every layer.** `computeBalances`
(`core/settle.ts`) re-checks integer cents, a non-negative amount, and the shares-sum itself
on every `ExpenseRecord`, rather than trusting storage. It does *not* currently re-check that
each individual `shareCents` is non-negative — the write path enforces that in four places and
the schema doesn't enforce it at all, so a hand-edited or corrupted row could slip a negative
share past this boundary. Narrow gap, not a live bug; worth a guard if `computeBalances` ever
gains other untrusted callers. One layer out, `createExpense` (`server/db/expenses.ts`) calls
`splitAmount` before touching the database, so an invalid split throws with nothing persisted.

**Foreign keys only prove a row exists, not that it belongs here.** `createExpense` checks that
`paidByMemberId` and every split participant belong to the target group *before* writing — the
FK to `Member` is satisfied by a member of *any* group, so a stale cross-group id would
otherwise write silently and corrupt both groups' balances. That check can still race a
concurrent delete between itself and the insert; the `catch` block re-checks and reports the
same `MemberNotInGroupError` rather than letting the raw FK violation surface as a 500.

**zod owns request structure; core owns cross-field arithmetic.** `server/api/schemas.ts`
validates types, presence, and numeric ranges, and deliberately lets an arithmetically
unbalanced PERCENT split (basis points not summing to 10000) parse successfully, trusting
`splitAmount` to reject it. Duplicating that rule at the zod layer would give the two layers
two independent copies of the same check that could silently drift apart.

**Every `:groupId`-scoped route calls `requireGroupExists` first**, else a bogus id surfaces as
a confusing "member not in group" (e.g. `createExpense`'s membership lookup just returns no
rows for a nonexistent group) — except `DELETE /api/groups/:groupId`, where `deleteGroup`
already turns a missing group's Prisma `P2025` into `GroupNotFoundError` on its own, making a
pre-check a redundant `SELECT`. Member deletion needs `requireGroupExists` *and* a
`(memberId, groupId)`-scoped lookup before deleting — that pair alone can't distinguish "group
doesn't exist" from "member isn't in this group," so without both, a nonexistent group would be
misreported as `MEMBER_NOT_FOUND`. On both `POST` routes, the cheap in-memory zod check runs
*before* the DB round trip, so a malformed body is rejected the same way regardless of whether
the URL's `groupId` is real.

**Core throws; the UI needs values.** `parseAmountToCents`/`formatCents` keep their throwing
contract (the server depends on it) — `web/lib/amount.ts` and `web/lib/percent.ts` each catch
`unknown` (never `instanceof ValidationError` — see Testing on why an `instanceof` check against
a not-yet-exported class can silently always pass) and substitute web-owned, user-facing copy.
Core owns the rule; web owns the words — core's own message JSON-stringifies the user's raw
input back at them, which is a developer sentence, not something to show a user.

## Errors & status codes

`server/api/errors.ts` is the one place that maps a thrown error to an HTTP status and JSON
body. Codes are hard-coded string literals, never derived from `error.name` or
`error.constructor.name`, so renaming a class later can't silently change the wire contract.

`ValidationError` (`core/errors.ts`) is for a fault in what the *caller* supplied — a bad
amount, an unbalanced split — and maps to 422. `core/settle.ts`'s throws describe corrupted
*stored* data, not the caller's fault, so they're deliberately plain, un-subclassed `Error`s
and map to 500; `money.ts`'s internal `unreachable:` guard is the same for the identical
reason — a triggered guard means the allocator is broken, not that input was bad.

A caught error's own `.message` never reaches the client — including `SyntaxError` from a
malformed JSON body. `toErrorResponse` can't tell a `SyntaxError` raised while parsing a
request body apart from one raised anywhere else for an unrelated reason, so that branch
returns a fixed message rather than depending on today's one call site never changing.

## Database

Prisma 7 dropped `datasource.url` from `schema.prisma`; the connection URL lives in
`prisma.config.ts`, and `PrismaClient` connects at runtime via `@prisma/adapter-better-sqlite3`
(`server/db/client.ts`) — this is what lets tests point each run at its own temp SQLite file.
`prisma.config.ts` needs its own `import 'dotenv/config'`; Prisma no longer loads `.env` for
you, and a from-scratch clone with no `.env` present needs the fallback documented in
`docs/decisions.md` (M3) to install at all.

**SQLite reports every FK violation as the same generic Prisma code, `P2003`.** The driver's
own `originalCode` disambiguates: `SQLITE_CONSTRAINT_FOREIGNKEY` means the referenced row
doesn't exist (an insert against a missing group/member); `SQLITE_CONSTRAINT_TRIGGER` means an
`ON DELETE RESTRICT` trigger fired (the row being deleted is still referenced). Verified
against the adapter's real error shape, not assumed from docs — see `foreignKeyViolationKind`
in `server/db/prismaErrors.ts`. Same caution for `P2002`: check `error.meta`'s constraint
fields, not just the bare code, since a second unique constraint later would otherwise get
mislabeled.

Member deletion relies on the database, not a pre-check: `deleteMember` attempts the delete and
catches the `P2003`/trigger case via `foreignKeyViolationKind`, turning it into
`MemberReferencedError`. No read-then-delete race.

## Testing

Tests live in `tests/`, mirroring `src/`. For `src/core`, tests are written *before* the
implementation. Prefer invariant tests — balances sum to zero, shares sum to the total — over
example-by-example assertions.

**CI (`.github/workflows/ci.yml`) runs `lint`, `typecheck`, `test`, then `build:web`** on
every push to `main` and every PR, on the Node version pinned in `.nvmrc`. It needs no
`DATABASE_URL` secret — `prisma.config.ts`'s fallback to `file:./dev.db` covers
`npm ci`/`prisma generate`, and `testDb.ts` injects its own per-run URL for every temp
database.

**Lint/format is Biome, not ESLint** — `typescript-eslint`'s peer range tops out below the
installed `typescript@7`, while Biome parses TypeScript itself with no `typescript`
dependency at all, so the TS version can't break it. `biome.jsonc` (not `.json`: Biome's
config loader silently falls back to hardcoded defaults — double quotes, semicolons, tabs —
on a `.json` file containing `//` comments, with no warning, so the comments explaining the
`tests/**` `noNonNullAssertion` override need the `.jsonc` extension to survive) matches the
repo's existing style (single quotes, no semicolons, 90-char width) rather than reformatting
to Biome's defaults. `npm run lint` passes `--error-on-warnings`: several rules this project
cares about (`noExplicitAny`) are warning-severity under Biome's `recommended` preset, and
plain `biome check` exits 0 on warnings alone. `*.css` is excluded — Biome's CSS parser
doesn't understand Tailwind v4's `@theme`/`@apply` at-rules, the same reason
`vitest.config.ts` doesn't mirror `@tailwindcss/vite` into the web test project.

**DB tests run the real migration.** `tests/server/db/testDb.ts` creates a temp SQLite file per
test file and runs the actual `prisma migrate deploy` against it, so tests prove the committed
migration works. Five files (three under `tests/server/db/`, two under `tests/server/api/`) pay
that multi-second cost in `beforeAll`, so `vitest.config.ts` gives the node project a 60s
`hookTimeout` and sets `fileParallelism: false` — concurrent migration subprocesses starve each
other under load (confirmed empirically, not assumed). `tests/server/api/routes.test.ts` stays
one file with four `describe` blocks rather than four files, to keep that migration cost at one.

**A `.rejects.toThrow(SomeClass)` test can pass for the wrong reason.** If `SomeClass` isn't
actually exported yet, the import silently resolves to `undefined`, and `toThrow(undefined)`
matches *any* thrown error — so the test is green before the feature exists. Verify a new
error-class test by mutation: temporarily revert the implementation and confirm the test fails.

`@tailwindcss/vite` is deliberately **not** mirrored into `vitest.config.ts`'s `web` project,
unlike every other Vite plugin — no test imports `index.css` and jsdom computes no styles
regardless, so mirroring it would scan CSS on every web test run for nothing (see
`vite.config.ts`'s header comment for the rule this is an exception to).

**`npm test` cannot catch a missing/misapplied Tailwind class, or a Vite-dev-server-only
routing bug** — no test renders through a real browser's CSS engine or spins up the real dev
server. A manual pass (`npm run dev` + `npm run dev:web`, both color schemes, a narrow
viewport) is not optional after a restyle or a client-routing change; see `docs/decisions.md`
(M5, M6) for the two bugs this exact gap already let through with a fully green suite.

**A short list of structural facts protects the whole suite from a restyle and must keep
holding:** expense/member rows stay `<li>` elements; the "Settle up" `<h2>` stays inside a
`<section>`; `BalanceList`/`TransferList` render exactly one `<li>` per data row (`BalanceBar`
is a decorative `aria-hidden` sibling, never its own list item); `ErrorBanner` returns literal
`null` (no wrapper) when there's no error; every button keeps a text accessible name; every
input keeps its `<label>`; anywhere a name is concatenated with an amount (`Money`,
`BalanceList`, the expense-preview list) keeps the literal punctuation/whitespace as real text
nodes — `toHaveTextContent`/`getByText` operate on concatenated `textContent`, which doesn't
insert a space or colon that isn't actually there.

## Web client

**Wire DTOs are hand-mirrored in `src/web/net/types.ts`, never imported from
`server/api/dto.ts`** — that file imports Prisma's generated client, which is gitignored and
only exists after `postinstall`. Proven honest at compile time by
`tests/web/net/types.test.ts`'s `Exact<A, B>` assertions (verified by mutation: renaming a
field on either side fails `npm run typecheck`) and at runtime by
`tests/web/net/contractLive.test.ts`, which drives the real web client against the real Hono
app.

`src/web/net/` is named that — not `api/` or `apiClient/` — to dodge a Vite dev-server proxy
prefix-match trap (`http-proxy-middleware` matches by string prefix, not path segment). Never
rename it to start with `api`; if you ever must, verify in a real browser — `npm test` and
`npm run typecheck` both stayed green throughout the original bug. See `docs/decisions.md` (M5).

The API client is a factory taking `fetch` as an argument (`createApiClient({ fetch, baseUrl
})`), never `globalThis.fetch` directly — like every other seam in the repo (`createApp(db)`,
`createDbClient(url)`). This is what makes the mocked-fetch unit tests and the real-app contract
test possible against the same production code; components reach the client through
`ApiClientProvider`/`useApiClient`, not a module-level singleton.

`groupKeys.settlement(id)` nests **under** `groupKeys.detail(id)`, so invalidating `detail`
refetches both in one call — correct because no mutation changes a group's members or expenses
without also changing its settlement. `useDeleteGroup` **removes** (not invalidates) the
deleted group's cache entry, to avoid refetching straight into a 404.

Each `MemberList` row owns its own `useDeleteMember` mutation instance, not a shared one — a
shared mutation's `isPending`/`error` would be global to the whole list, misattributing one
row's error to another's in-flight click.

`SplitEditor`'s local raw-text buffer is keyed by `` `${mode}:${memberId}` ``, not `memberId`
alone, so a mode switch can't leak one mode's typed-but-uncommitted text into another mode's
field.

Dark mode uses no `dark:` variant anywhere in markup — `index.css`'s `@theme` tokens resolve
through `var()`, and a `prefers-color-scheme` override on `:root` flips every utility at once.
Verified surviving Tailwind's production build (`dist/web/assets/*.css` shows `var(...)`, not
an inlined value), not just assumed.

**Known deliberate non-fixes**, both from a `/code-review` pass: `tsconfig.json`'s single
shared `lib` includes DOM program-wide (a real but accepted cost of one tsconfig — `lib` was
never the dependency rule's actual enforcement; `tests/core/dependencyRule.test.ts` is).
`Money.tsx` calls `formatCents` with no guard and there's no `ErrorBoundary` anywhere, because
every `cents` value reaching it already comes from a validated server DTO or a try/caught
`splitAmount` call — a malformed value reaching this deep would mean a real upstream bug, not a
case worth defending against.

## Out of scope

No auth — any group id is world-readable and world-writable. No pagination on `listGroups` or
expense lists. No update endpoints — expenses and members are create/delete only; deletion is
permanent and unlogged. No multi-currency arithmetic — currency is a stored label, not enforced
or converted. No expense edit history. These are real gaps for a production app and correct
scope for this one — don't propose closing them unless asked.

## Status

Done through **M6**: `core` (money/split/settle), the Prisma-backed REST API, the React
client, and a Tailwind visual pass. 390 tests; `npm test`, `npm run typecheck`, and
`npm run lint` all green. Published at `github.com/alifhaziqr/Split`, with GitHub Actions
CI (lint, typecheck, test, build) on push/PR.

**Next** — not yet decided.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`alifhaziqr/Split`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
