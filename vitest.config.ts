import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Five files spawn a real `prisma migrate deploy` subprocess in beforeAll
    // (see testDb.ts): the three under tests/server/db/ (expenses, groups,
    // members) plus two added in M4 under tests/server/api/ (routes,
    // endToEnd) — a multi-second cost, five times per run. Vitest's 10s
    // default hookTimeout fails several suites at once on a loaded machine;
    // raised to give the migration room.
    hookTimeout: 60_000,
    // Running all five of those subprocesses at once (vitest's default
    // parallel-file execution) reproducibly starves one another under load —
    // confirmed by running the suite repeatedly: some runs pass, some fail
    // several suites at once on the *same* 60s hookTimeout above, which is
    // resource contention, not an insufficient timeout. Serializing files
    // trades wall-clock time for a suite that passes every time; the next
    // real fix (deferred, see CLAUDE.md's M4 conventions) is a vitest
    // globalSetup that migrates once into a template file each test file
    // then cheaply copies, which would make this unnecessary.
    fileParallelism: false,
  },
})
