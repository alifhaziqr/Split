/**
 * Spins up a fresh SQLite file with every migration applied via the real
 * `prisma migrate deploy`, so tests exercise the same migration path
 * production deployment does rather than an ad-hoc schema.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createDbClient } from '../../../src/server/db/client.js'
import type { PrismaClient } from '../../../src/generated/prisma/client.js'

export interface TestDatabase {
  db: PrismaClient
  cleanup: () => Promise<void>
}

export function createTestDatabase(): TestDatabase {
  const dir = mkdtempSync(join(tmpdir(), 'split-test-'))
  const url = `file:${join(dir, 'test.db')}`

  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    })
  } catch (error) {
    rmSync(dir, { recursive: true, force: true })
    throw error
  }

  const db = createDbClient(url)

  return {
    db,
    cleanup: async () => {
      await db.$disconnect()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

/** Empties every table in FK-safe order, for isolating tests within a shared database. */
export async function resetDb(db: PrismaClient): Promise<void> {
  await db.expenseShare.deleteMany()
  await db.expense.deleteMany()
  await db.member.deleteMany()
  await db.group.deleteMany()
}
