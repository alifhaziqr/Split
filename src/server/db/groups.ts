import type { Expense, ExpenseShare, Group, Member, PrismaClient } from '../../generated/prisma/client.js'

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
