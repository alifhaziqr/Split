# Decisions & incident log

Long-form narratives of debugging sessions and decisions whose full detail isn't needed by
default in every session's context, but is worth having on hand if something similar comes up
again. `CLAUDE.md` keeps a one-line rule and a pointer here; this file keeps the story.

## M3 — a fresh clone couldn't actually install (`prisma generate` / `DATABASE_URL`)

`prisma generate` must run on install, not just once by hand. `src/generated/prisma` is
gitignored, so a fresh clone has nothing until `postinstall` in `package.json` runs it — found
by deleting the directory and running `npm test`. That first check left the developer's own
`.env` in place, though, and `.env` is *also* gitignored (only `.env.example` is committed) —
so it didn't actually prove a from-scratch clone works. A true clean clone (`git archive HEAD`
into an empty directory) failed: `prisma.config.ts` read `env('DATABASE_URL')`, which throws
when unset, so `postinstall` itself failed before `src/generated` could be produced. Fixed by
giving `prisma.config.ts` a `process.env.DATABASE_URL ?? 'file:./dev.db'` fallback — dotenv
never overwrites an already-set variable, so an explicit `DATABASE_URL` (tests pass their own)
still wins. Verified against a real clean clone with no `.env` present: `npm install && npm
test` is green.

## M5 — the Vite `/api` proxy prefix-match trap

`src/web/net/` — not `src/web/api/` or `src/web/apiClient/` — because of a proxy-matching trap
only visible by actually running `npm run dev:web` in a browser, not by any test. Vite's dev
server serves source files at a URL path mirroring their location under `root` (`src/web`), so
a file at `src/web/api/client.ts` is served at `/api/client.ts` — colliding with
`vite.config.ts`'s `server.proxy['/api']` rule for the *real* backend. Worse,
`http-proxy-middleware` matches that proxy key as a plain **string prefix**, not a path
segment: `/apiClient/apiClientContext.tsx` still starts with the literal string `/api` and gets
proxied to the Hono server too (which 404s it), so renaming `api/` to `apiClient/` did not fix
it — only a directory name that doesn't start with `api` at all does. `npm test` and `npm run
typecheck` were both green throughout this bug because no test spins up the real Vite dev
server; only opening the app in an actual browser surfaced it (three `Failed to load resource:
404` console errors). If a future rename ever reintroduces a path segment starting with `api`,
re-check the dev server in a browser, not just `npm test`.

## M6 — Tailwind Preflight, and a viewport clipping bug no test caught

Tailwind Preflight strips all browser default styling the instant the plugin is added — list
bullets, heading sizes, button chrome, form-control borders — so there was no safe intermediate
commit between "Tailwind installed" and "baseline element layer written." Both landed in one
step. A future removal or major-version bump of Tailwind should be checked in a real browser
before merging, not just via `npm test`.

`npm test` cannot catch a missing or misapplied Tailwind utility class — the same blind spot
that let the M5 `/api` proxy bug ship with a fully green suite — no test renders through a real
browser's CSS engine. It did let one bug through, in this milestone: `AddExpenseForm`'s
Description/Amount and Paid-by/Date rows used fixed-width columns (`w-32`, `w-40`) that clipped
the `<select>`'s visible text on a 375px viewport — invisible to every automated check, fixed
by making those columns stack (`sm:flex-row`, `sm:w-32`/`sm:w-40`) below the `sm` breakpoint. A
restyle's manual verification pass (real `npm run dev` + `npm run dev:web`, both color schemes,
a narrow viewport) is not optional polish; it's the only check that would have caught it.
