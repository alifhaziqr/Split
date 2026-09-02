import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Each of the three tests/server/db/*.test.ts files spawns a real
    // `prisma migrate deploy` subprocess in beforeAll (see testDb.ts) — a
    // multi-second cost. Vitest's 10s default hookTimeout fails all three
    // suites at once on a loaded machine; raised to give the migration room.
    hookTimeout: 60_000,
  },
})
