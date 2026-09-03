import { Prisma } from '../../generated/prisma/client.js'

/**
 * SQLite reports every foreign-key violation as the same generic P2003, so
 * the driver's own `originalCode` disambiguates: a bare constraint failure
 * means the referenced row doesn't exist (used on insert), while a trigger
 * firing means a RESTRICT delete hit a row that still references this one.
 * Verified against this adapter's actual error shape, not assumed from docs.
 */
export function foreignKeyViolationKind(
  error: unknown,
): 'missing-reference' | 'restricted-by-reference' | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2003'
  ) {
    return null
  }
  const meta = error.meta as
    | { driverAdapterError?: { cause?: { originalCode?: string } } }
    | undefined
  const originalCode = meta?.driverAdapterError?.cause?.originalCode
  if (originalCode === 'SQLITE_CONSTRAINT_TRIGGER') return 'restricted-by-reference'
  if (originalCode === 'SQLITE_CONSTRAINT_FOREIGNKEY') return 'missing-reference'
  return null
}
