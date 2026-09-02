import { Prisma } from '../../generated/prisma/client.js'
import type { Expense, ExpenseShare, Group, Member, PrismaClient } from '../../generated/prisma/client.js'
import { foreignKeyViolationKind } from './prismaErrors.js'

export class GroupNotFoundError extends Error {
  constructor(groupId: string) {
    super(`Group ${groupId} does not exist`)
    this.name = 'GroupNotFoundError'
  }
}

export class GroupNotEmptyError extends Error {
  constructor(groupId: string) {
    super(`Group ${groupId} still has members or expenses and cannot be deleted`)
    this.name = 'GroupNotEmptyError'
  }
}

export interface CreateGroupInput {
  readonly name: string
  readonly currency: string
}

export function createGroup(db: PrismaClient, input: CreateGroupInput): Promise<Group> {
  return db.group.create({ data: input })
}

export interface GroupDetails extends Group {
  readonly members: Member[]
  readonly expenses: (Expense & { shares: ExpenseShare[] })[]
}

export function getGroupWithDetails(db: PrismaClient, groupId: string): Promise<GroupDetails | null> {
  return db.group.findUnique({
    where: { id: groupId },
    include: {
      members: true,
      expenses: { include: { shares: true } },
    },
  })
}

/**
 * Ordered by createdAt descending, then id ascending as an explicit
 * tiebreaker: the schema's createdAt column defaults to CURRENT_TIMESTAMP,
 * which SQLite fills at whole-second resolution, so several groups created
 * within one request can share a createdAt — id (a cuid) is what actually
 * guarantees a stable, repeatable order.
 */
export function listGroups(db: PrismaClient): Promise<Group[]> {
  return db.group.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  })
}

export async function deleteGroup(db: PrismaClient, groupId: string): Promise<void> {
  try {
    await db.group.delete({ where: { id: groupId } })
  } catch (error) {
    if (foreignKeyViolationKind(error) === 'restricted-by-reference') {
      throw new GroupNotEmptyError(groupId)
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new GroupNotFoundError(groupId)
    }
    throw error
  }
}
