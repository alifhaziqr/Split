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
- **M5 done** — a React + Vite client under `src/web` (`net/` the injectable fetch client and
  hand-mirrored wire types, `queries/` TanStack Query hooks, `lib/` text-parsing wrappers
  around core, `components/`, `features/{groups,members,expenses,settlement}/`, `pages/`),
  covering full CRUD for groups/members/expenses plus the settle-up view. Test-first, then a
  `/code-review` pass whose findings were verified and fixed test-first too, then the
  milestone's own named end-to-end verification
  (`tests/web/integration/addExpenseFlow.test.tsx`: create a group, add three members, record
  two mixed-payer expenses, confirm the settle-up section's transfers zero every balance —
  driven through the real UI against a real migrated database, not a scripted fetch stub).
  374 tests.
- **M6 done** — a visual design pass over `src/web` with Tailwind CSS v4: an `@theme` block of
  semantic color tokens in `index.css` replacing the old hand-rolled global rules, an
  `AppShell` (sticky header, centred content), card surfaces, and a proportional
  `BalanceBar` on the settle-up view (`features/settlement/balanceBar.ts`, written
  test-first). Presentation only — no changes to `src/core`, `src/server`, or any query
  hook. All 25 existing `.tsx` files gained `className`s; the suite's near-total
  presentation-agnosticism (see Conventions below) meant this cost zero test rewrites. 390
  tests.
- **Next** — not yet decided.

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

## Conventions settled in M5

**`src/web` may import `src/core`, but only `core/money.ts` and `core/split.ts` — never
`src/server`, and never `core/settle.ts`.** See the Architecture section above for the exact
wording. `core` is genuinely browser-safe (zero npm deps, zero Node built-ins), and basis
points are to percent exactly what cents are to dollars — `parseAmountToCents('33.33')`
returns `3333`, which *is* the `percentBp` the API wants — so `lib/amount.ts` and
`lib/percent.ts` delegate to `parseAmountToCents`/`formatCents` rather than re-implementing
the two-decimal parsing rule in the one place a human types a decimal. `core/settle.ts` stays
off limits because balances and transfers come from the server, the only authority on what a
group owes; the client's own `AddExpenseForm` preview calls `core/split.ts`'s `splitAmount`
directly to show the M1 largest-remainder allocation before submitting, but that is strictly a
preview — the server recomputes and stores its own result.
`tests/core/dependencyRule.test.ts` enforces the whole rule by resolving every relative import
against its own file's directory, not by matching substrings.

**Core throws; the UI needs values.** `parseAmountToCents`/`formatCents` keep their throwing
contract (the server depends on it) — `lib/amount.ts` and `lib/percent.ts` each wrap a call in
`try { } catch { }` (catching `unknown`, never `instanceof ValidationError` — see the M3 note
above on `instanceof` against an import silently resolving to `undefined`) and substitute
web-owned, user-facing copy. Core owns the rule; web owns the words — core's own message
JSON-stringifies the user's raw input back at them, which is a developer sentence, not
something to show a user.

**Wire DTOs are hand-mirrored in `src/web/net/types.ts`, never imported from
`src/server/api/dto.ts`.** That file imports Prisma's generated client, which is gitignored
and only exists after `postinstall`; importing it from web would couple the client's type
graph to generated output it has no business depending on. The mirror is proven honest at
**compile time** by `tests/web/net/types.test.ts`'s `Exact<A, B>` conditional-type assertions
(verified by mutation: renaming a field on either side makes `npm run typecheck` fail) and at
**runtime** by `tests/web/net/contractLive.test.ts`, which drives the real web API client
against the real Hono app (`createApp(db).request` injected as the client's `fetch`) — catching
response-shape drift that a mocked-fetch unit test cannot.

**`src/web/net/` — not `src/web/api/` or `src/web/apiClient/` — because of a proxy-matching
trap only visible by actually running `npm run dev:web` in a browser, not by any test.**
Vite's dev server serves source files at a URL path mirroring their location under `root`
(`src/web`), so a file at `src/web/api/client.ts` is served at `/api/client.ts` — colliding
with `vite.config.ts`'s `server.proxy['/api']` rule for the *real* backend. Worse,
`http-proxy-middleware` matches that proxy key as a plain **string prefix**, not a path
segment: `/apiClient/apiClientContext.tsx` still starts with the literal string `/api` and
gets proxied to the Hono server too (which 404s it), so renaming `api/` to `apiClient/` did
not fix it — only a directory name that doesn't start with `api` at all does. `npm test` and
`npm run typecheck` were both green throughout this bug because no test spins up the real
Vite dev server; only opening the app in an actual browser surfaced it (three `Failed to load
resource: 404` console errors). If a future rename ever reintroduces a path segment starting
with `api`, re-check the dev server in a browser, not just `npm test`.

**The API client is a factory that takes `fetch` as an argument, never `globalThis.fetch`
directly** (`createApiClient({ fetch, baseUrl })`, built on `createRequest(fetchImpl)`) —
matching every existing seam in this repo (`createApp(db)`, `createDbClient(url)`,
`createHttpClient(getApp)`). This is what makes both the mocked-fetch unit tests and the
real-app contract test possible with the same production code, and it's why components reach
the client through `ApiClientProvider`/`useApiClient` rather than a module-level singleton.

**`groupKeys.settlement(id)` is nested *under* `groupKeys.detail(id)`, not a sibling key.**
TanStack Query's `invalidateQueries` is prefix-matched, so invalidating `detail(id)` refetches
both in one call — correct because no mutation changes a group's members or expenses without
also changing its settlement (`server/settlement.ts` seeds a zero balance for every member, so
a brand-new member appears in `balances` immediately).
`tests/web/queries/queryKeys.test.ts` asserts the prefix relationship directly, and
`tests/web/queries/members.test.tsx` proves it actually triggers a second fetch — not just
that the keys look right in isolation. `useDeleteGroup` **removes** (not invalidates) the
deleted group's `detail` entry: invalidating it would refetch straight into a 404 and flash an
error on the way out. `useDeleteExpense`'s mutation variables are `{expenseId, groupId}` even
though `DELETE /api/expenses/:expenseId` sends only the id — `groupId` exists solely so the
mutation knows which group's cache to invalidate, and is easy to drop by accident.

**Each `MemberList` row calls `useDeleteMember` itself — one mutation instance per row, not
one shared instance reused across the list.** A shared mutation's `isPending`/`error` are
global to the whole list: two different rows' Remove buttons confirmed in quick succession
(before a re-render commits the first click's `isPending`) could both fire, and a later row's
error could get attributed to the wrong row. Verified directly: temporarily reverting to the
shared-mutation version makes `tests/web/features/members/MemberList.test.tsx`'s
in-flight-isolation test fail exactly as predicted.

**`SplitEditor`'s local raw-text buffer is keyed by `` `${mode}:${memberId}` ``, not
`memberId` alone.** EXACT and PERCENT each get their own text slot; keying by member id alone
let one mode's typed-but-not-yet-parsed text reappear as if it had been entered into the other
mode after a switch (e.g. typing "50.00" in EXACT, switching to PERCENT, and seeing "50.00"
sitting in the percent field as if 50% had been typed, while the committed value was actually
still unset). The SHARES weight stepper commits only a validated non-negative integer — an
in-progress decimal or a stray `-` is never propagated to the draft, so a value `splitStatus`
would accept as "balanced" can never be one the server's `z.int()` schema would reject.

**Every money display goes through `formatCents` (usually via the `Money` component), never
`(cents / 100).toFixed(2)`.** This applies even to a client-side-only preview with no arithmetic
feeding back into storage — CLAUDE.md's "never floats for money" rule is about every display,
not only paths that write to storage. No divergent value has actually been found across the
whole practical cents range (V8's `toFixed` happens to round correctly there), so this is
enforced for consistency with the rest of the app and the stated architectural principle, not
because a concrete rendering bug was reproduced.

**Two things a `/code-review` pass flagged and this milestone deliberately left as is, rather
than adding code:**
- `tsconfig.json`'s `lib` now includes `"DOM"`/`"DOM.Iterable"` program-wide (there is only one
  tsconfig — see the "why one tsconfig" reasoning that would otherwise apply here), so
  `src/core`/`src/server` can now reference `window`/`document` without a type error. `lib`
  was never the real enforcement mechanism for the dependency rule — `tests/core/
  dependencyRule.test.ts` is — so this is a real but already-accepted cost of staying on one
  tsconfig rather than a two-tsconfig split, not a regression to fix.
- `components/Money.tsx` calls `formatCents` with no guard, so a non-integer `cents` value
  would throw and, with no `ErrorBoundary` anywhere in `App.tsx`/`main.tsx`, blank the page.
  Every `cents` value that reaches `Money` originates from a server DTO or from `core/
  split.ts`'s own `splitAmount` (already wrapped in its own `try`/`catch` at the one call
  site that can fail), so a malformed value reaching this deep, interior component would mean
  a real upstream bug — the same "trust internal code, don't defend against scenarios that
  can't happen" reasoning `core/settle.ts`'s own un-subclassed throws already document above.

## Conventions settled in M6

**`@tailwindcss/vite` is deliberately NOT mirrored into `vitest.config.ts`'s `web` project**,
breaking the rule `vite.config.ts`'s own header comment states for every other plugin. That
rule exists so a transform difference can't make a test pass while the real app breaks — it
doesn't apply here because Tailwind transforms CSS only, no test imports `index.css`
(`main.tsx` is its sole importer, and `main.tsx` is deliberately untested), and jsdom computes
no styles regardless. Mirroring it would add a CSS scan to every web test run for nothing.
`vite.config.ts`'s comment records this exception so it isn't "fixed" by a future reader.

**Dark mode uses no `dark:` variant anywhere in markup.** `index.css`'s `@theme` block defines
semantic tokens (`--color-canvas`, `--color-fg`, `--color-accent`, ...) that Tailwind's
generated utilities resolve through `var()` at use time; a `prefers-color-scheme` media query
overrides those same custom properties on `:root`, and every utility across the app flips at
once. Verified in the actual built CSS, not assumed: `dist/web/assets/*.css` shows `a{color:
var(--color-accent);...}`, not an inlined value, confirming the indirection survives Tailwind's
production build (lightningcss minification does not inline theme values here).

**Tailwind Preflight strips all browser default styling** the instant the plugin is added —
list bullets, heading sizes, button chrome, form-control borders — so there is no safe
intermediate commit between "Tailwind installed" and "baseline element layer written." Both
landed in one step. A future removal or major-version bump of Tailwind should be checked in a
real browser before merging, not just via `npm test`, for the same reason the invariants below
need a real browser too.

**A short list of structural facts protect the whole suite from a restyle, and must keep
holding:** expense rows and member rows stay `<li>` elements; the "Settle up" `<h2>` stays
inside a `<section>` (`integration/addExpenseFlow.test.tsx` does `.closest('section')`);
`BalanceList`/`TransferList` render exactly one `<li>` per data row — `BalanceBar` is a
decorative `aria-hidden` sibling inside that `<li>`, never a list item of its own;
`ErrorBanner` returns literal `null` (no wrapper element) when there is no error; every button
keeps a **text** accessible name (icons, if ever added, must be `aria-hidden` and additive);
every input keeps its `<label>` association. `Money.tsx` and any place that concatenates a
name with an amount (`BalanceList`, `AddExpenseForm`'s preview list) must keep the literal
punctuation and whitespace between them as real text nodes in document order — `toHaveTextContent`
and `getByText` both operate on concatenated `textContent`, which does not insert a space or
colon that isn't actually in the DOM.

**`npm test` cannot catch a missing or misapplied Tailwind utility class**, the same blind
spot that let the M5 `/api` proxy bug ship with a fully green suite — no test renders through
a real browser's CSS engine. A restyle's manual verification pass (real `npm run dev` +
`npm run dev:web`, both color schemes, a narrow viewport) is not optional polish; it's the
only check that would have caught it. It did, once, in this milestone: `AddExpenseForm`'s
Description/Amount and Paid-by/Date rows used fixed-width columns (`w-32`, `w-40`) that
clipped the `<select>`'s visible text on a 375px viewport — invisible to every automated
check, fixed by making those columns stack (`sm:flex-row`, `sm:w-32`/`sm:w-40`) below the `sm`
breakpoint.
