import react from '@vitejs/plugin-react'
import { defaultExclude, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Two environments (node for core/server, jsdom for the React client), so
    // two projects. `test.projects` is the only mechanism vitest 4 still
    // offers for this: `environmentMatchGlobs` and the separate
    // vitest.workspace.ts file were both removed (vitest now throws outright
    // on `test.workspace`). Per-file `// @vitest-environment jsdom` docblocks
    // still work, but they are one config for the whole run — which would
    // force the fast web tests to inherit the node project's
    // `fileParallelism: false` below, and would load the web project's
    // `setupFiles` (jest-dom's matchers, RTL's cleanup) into every node test
    // too, in an environment with no `document`.
    //
    // IMPORTANT: options set at THIS root `test` level are NOT inherited by
    // the projects below. Once `projects` exists, vitest builds its project
    // list only from this array and the root config never becomes a test
    // project itself — so `globals` and `hookTimeout` are repeated inside
    // `node` deliberately. Moving either one out here would silently disable
    // it for every test that needs it.
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          globals: true,
          // Everything that isn't the web client. Written as an exclude
          // rather than an explicit tests/{core,server} list so a future
          // top-level test directory defaults to the node environment.
          include: ['tests/**/*.test.ts'],
          exclude: [...defaultExclude, 'tests/web/**'],
          // Five files spawn a real `prisma migrate deploy` subprocess in
          // beforeAll (see testDb.ts): the three under tests/server/db/
          // (expenses, groups, members) plus two added in M4 under
          // tests/server/api/ (routes, endToEnd) — a multi-second cost, five
          // times per run. Vitest's 10s default hookTimeout fails several
          // suites at once on a loaded machine; raised to give the migration
          // room.
          hookTimeout: 60_000,
          // Running all five of those subprocesses at once (vitest's default
          // parallel-file execution) reproducibly starves one another under
          // load — confirmed by running the suite repeatedly: some runs
          // pass, some fail several suites at once on the *same* 60s
          // hookTimeout above, which is resource contention, not an
          // insufficient timeout. Serializing files trades wall-clock time
          // for a suite that passes every time; the next real fix (deferred,
          // see CLAUDE.md's M4 conventions) is a vitest globalSetup that
          // migrates once into a template file each test file then cheaply
          // copies, which would make this unnecessary.
          //
          // Scoped to THIS project only — vitest turns this into
          // maxWorkers: 1, and a maxWorkers === 1 project runs in its own
          // scheduling group *after* the others, so the web project below
          // still runs fully parallel regardless of this setting.
          fileParallelism: false,
        },
      },
      {
        // Same React transform the dev server and `vite build` use (see
        // vite.config.ts), so a transform difference can't make a test pass
        // while the real app breaks.
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          globals: true,
          include: ['tests/web/**/*.test.{ts,tsx}'],
          // Registers @testing-library/jest-dom's matchers and unmounts
          // whatever React Testing Library rendered, so a component from one
          // test isn't still in the jsdom document during the next. Scoped
          // to this project so it never loads into the node tests, which
          // have no `document`.
          setupFiles: ['tests/web/setup.ts'],
          // No project-wide hookTimeout override: almost nothing here
          // spawns a subprocess, so vitest's 10s default stays the right
          // budget and a slow web test is a bug worth failing on. Two files
          // ARE real exceptions — tests/web/net/contractLive.test.ts and
          // tests/web/integration/addExpenseFlow.test.tsx drive the real
          // Hono app against a real migrated temp database (see testDb.ts),
          // same as the five node-project files that motivated the setting
          // below. Rather than raise this project's timeout for everyone,
          // each of those two files passes an explicit 60_000 directly to
          // its own `beforeAll` — a targeted fix over a blanket one.
        },
      },
    ],
  },
})
