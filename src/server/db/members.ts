import { Prisma } from '../../generated/prisma/client.js'
import type { Member, PrismaClient } from '../../generated/prisma/client.js'

export class DuplicateMemberError extends Error {
  constructor(groupId: string, name: string) {
    super(`Member ${JSON.stringify(name)} already exists in group ${groupId}`)
    this.name = 'DuplicateMemberError'
  }
}

export class MemberReferencedError extends Error {
  constructor(memberId: string) {
    super(`Member ${memberId} is referenced by an expense and cannot be deleted`)
    this.name = 'MemberReferencedError'
  }
}

export class GroupNotFoundError extends Error {
  constructor(groupId: string) {
    super(`Group ${groupId} does not exist`)
    this.name = 'GroupNotFoundError'
  }
}

export class MemberNotFoundError extends Error {
  constructor(memberId: string) {
    super(`Member ${memberId} does not exist`)
    this.name = 'MemberNotFoundError'
  }
}

/**
 * SQLite reports every foreign-key violation as the same generic P2003, so
 * the driver's own `originalCode` disambiguates: a bare constraint failure
 * means the referenced row doesn't exist (used on insert), while a trigger
 * firing means a RESTRICT delete hit a row that still references this one.
 * Verified against this adapter's actual error shape, not assumed from docs.
 */
function foreignKeyViolationKind(error: unknown): 'missing-reference' | 'restricted-by-reference' | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2003') {
    return null
  }
  const meta = error.meta as { driverAdapterError?: { cause?: { originalCode?: string } } } | undefined
  const originalCode = meta?.driverAdapterError?.cause?.originalCode
  if (originalCode === 'SQLITE_CONSTRAINT_TRIGGER') return 'restricted-by-reference'
  if (originalCode === 'SQLITE_CONSTRAINT_FOREIGNKEY') return 'missing-reference'
  return null
}

/**
 * P2002 is Prisma's generic "some unique constraint failed" code, not
 * specific to (groupId, name) — check which columns actually collided so a
 * future unrelated unique constraint on Member doesn't get mislabeled as a
 * duplicate name.
 */
function violatesMemberNameUniqueness(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false
  }
  const meta = error.meta as { driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } } | undefined
  const fields = meta?.driverAdapterError?.cause?.constraint?.fields ?? []
  return fields.includes('name') && fields.includes('groupId')
}

export async function addMember(db: PrismaClient, groupId: string, name: string): Promise<Member> {
  try {
    return await db.member.create({ data: { groupId, name } })
  } catch (error) {
    if (violatesMemberNameUniqueness(error)) {
      throw new DuplicateMemberError(groupId, name)
    }
    if (foreignKeyViolationKind(error) === 'missing-reference') {
      throw new GroupNotFoundError(groupId)
    }
    throw error
  }
}

export async function deleteMember(db: PrismaClient, memberId: string): Promise<void> {
  try {
    await db.member.delete({ where: { id: memberId } })
  } catch (error) {
    if (foreignKeyViolationKind(error) === 'restricted-by-reference') {
      throw new MemberReferencedError(memberId)
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new MemberNotFoundError(memberId)
    }
    throw error
  }
}
