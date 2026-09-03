# Split

A small expense-sharing app — Splitwise-lite. Create a group, log who paid for what, and get back
a short list of who owes whom, in exact cents.

## Features

- **Groups & members** — create a group, add and remove members freely.
- **Expenses, split four ways:**
  - **Equal** — split evenly among the people selected.
  - **Exact** — type each person's amount yourself.
  - **Percent** — assign each person a percentage (must add up to 100%).
  - **Shares** — assign each person a weight (e.g. "2 shares" gets twice "1 share").
- **Settle up** — see each member's net balance and the shortest sensible list of payments to
  clear it.
- **Dark mode** — follows your system preference automatically.
- **No accounts** — nothing to sign up for; a group's URL is all you need.

## Tech stack

| Layer       | Technology                                                                       |
| ----------- | -------------------------------------------------------------------------------- |
| Language    | TypeScript 7                                                                     |
| Core logic  | Plain TypeScript — no dependencies (money math, splitting, settlement)           |
| API server  | [Hono](https://hono.dev/) 4, [zod](https://zod.dev/) 4 for request validation    |
| Database    | SQLite via [Prisma](https://www.prisma.io/) 7 (`@prisma/adapter-better-sqlite3`) |
| Web client  | React 19, React Router 8, [TanStack Query](https://tanstack.com/query) 5         |
| Build/dev   | Vite 8, tsx                                                                      |
| Styling     | Tailwind CSS 4                                                                   |
| Testing     | Vitest 4, Testing Library                                                        |
| Lint/format | [Biome](https://biomejs.dev/) 2                                                  |
| CI          | GitHub Actions                                                                   |

## Running it locally

Requires **Node 24** (pinned in `.nvmrc`).

```bash
git clone https://github.com/alifhaziqr/Split.git
cd Split
nvm use                      # switches to Node 24
npm install                  # also runs `prisma generate` (postinstall)
cp .env.example .env         # sets DATABASE_URL and PORT for local dev
npx prisma migrate deploy    # creates dev.db — needed once before first run
```

Then, in **two terminals**:

```bash
npm run dev       # terminal 1 — API server on :3000
npm run dev:web   # terminal 2 — web client on :5173
```

Open **http://localhost:5173** — not :3000, which serves JSON only.

`npm install` alone (no `.env` needed) is enough to run the test suite and typecheck — a
fallback in `prisma.config.ts` covers a from-scratch clone.

### All scripts

| Command               | What it does                                        |
| --------------------- | --------------------------------------------------- |
| `npm run dev`         | Start the API server (watches for changes)          |
| `npm run dev:web`     | Start the Vite dev server for the web client        |
| `npm test`            | Run the test suite once                             |
| `npm run test:watch`  | Run the test suite in watch mode                    |
| `npm run lint`        | Check lint + formatting (Biome)                     |
| `npm run lint:fix`    | Auto-fix lint/formatting issues                     |
| `npm run typecheck`   | Type-check with `tsc --noEmit`                      |
| `npm run build:web`   | Typecheck, then build the web client for production |
| `npm run preview:web` | Serve the production build locally                  |

## How the project is organised

```
src/
  core/     Pure TypeScript — money math, the four split modes, settlement.
            No I/O, no database, no framework. Fully unit-tested, test-first.
  server/   Hono API + Prisma/SQLite. May import core.
  web/      React app. Talks to the server over HTTP only — never imports
            server code, and only imports a narrow, read-only slice of core.
tests/      Mirrors src/, one test file per source file.
docs/       Design records and an incident log (see below).
prisma/     Database schema and migrations.
```

Dependencies point one way: `core → nothing`, `server → core`, `web → core (narrow slice) `. If a
change ever wants to break that rule, it's a sign to reconsider the design rather than punch
through it — and it's not just a convention: `tests/core/dependencyRule.test.ts` fails CI if any
file violates it.

## Testing & CI

54 test files, 390 tests, all passing. Split into two Vitest projects: a `node` project (core and
server, including tests that run real Prisma migrations against a temp SQLite file) and a `web`
project (React components, using jsdom).

GitHub Actions runs on every push to `main` and every pull request: lint → typecheck → test →
build. See `.github/workflows/ci.yml`.

One honest caveat: no automated test renders through a real browser's CSS engine, so a visual
change (a restyle, a routing change) still needs a manual pass — `npm run dev` + `npm run dev:web`
in an actual browser — before it can be trusted. See `docs/decisions.md` for the two bugs that
gap already let through.

## Out of scope

Deliberate boundaries for a learning project of this size, not gaps waiting to be filled:

- **No authentication** — any group's ID is both world-readable and world-writable.
- **No pagination** — group and expense lists are unpaginated.
- **No editing** — expenses and members can be created and deleted, not edited; deletion is
  permanent and unlogged.
- **No real multi-currency support** — currency is a stored label, not converted or enforced.
- **No expense edit history.**

## Learning

This project solely exist for testing on how Claude Code implement itself based of my prompts
and knowledge.
