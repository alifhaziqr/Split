/**
 * Builds a PrismaClient bound to a specific SQLite file via the
 * better-sqlite3 driver adapter — Prisma 7 moved connection wiring out of
 * the schema, so the URL is supplied here rather than read from env at
 * import time. This is what lets tests point each run at its own temp file.
 */

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

import { PrismaClient } from '../../generated/prisma/client.js'

export function createDbClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl })
  return new PrismaClient({ adapter })
}
