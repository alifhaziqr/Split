import { splitAmount } from '../../core/split.js'
import type { SplitInput } from '../../core/split.js'
import { Prisma } from '../../generated/prisma/client.js'
import type { Expense, ExpenseShare, PrismaClient } from '../../generated/prisma/client.js'

export interface CreateExpenseInput {
  readonly groupId: string
  readonly description: string
  readonly amountCents: number
  readonly paidByMemberId: string
  readonly date: Date
  readonly split: SplitInput
}

export interface ExpenseWithShares extends Expense {
  readonly shares: ExpenseShare[]
}

export class MemberNotInGroupError extends Error {
  constructor(memberId: string, groupId: string) {
    super(`Member ${memberId} does not belong to group ${groupId}`)
    this.name = 'MemberNotInGroupError'
  }
}

export class ExpenseNotFoundError extends Error {
  constructor(expenseId: string) {
    super(`Expense ${expenseId} does not exist`)
    this.name = 'ExpenseNotFoundError'
  }
}

/**
 * Computes shares with core/split.ts *before* touching the database, so an
 * invalid split (wrong percentages, mismatched exact shares) throws with
 * nothing written — this is the one place the data model's "materialised at
 * write time" rule from CLAUDE.md actually gets enforced.
 *
 * The foreign keys only guarantee a memberId exists *somewhere*, not that it
 * belongs to this group, so cross-group membership is checked here — a
 * stale client-side member id from a different group would otherwise write
 * silently and corrupt both groups' balances with no error anywhere.
 */
export async function createExpense(db: PrismaClient, input: CreateExpenseInput): Promise<ExpenseWithShares> {
  const shares = splitAmount(input.amountCents, input.split)

  const memberIds = new Set([input.paidByMemberId, ...shares.keys()])
  const membersInGroup = await db.member.findMany({
    where: { id: { in: [...memberIds] }, groupId: input.groupId },
    select: { id: true },
  })
  const foundIds = new Set(membersInGroup.map((member) => member.id))
  for (const memberId of memberIds) {
    if (!foundIds.has(memberId)) {
      throw new MemberNotInGroupError(memberId, input.groupId)
    }
  }

  return db.expense.create({
    data: {
      groupId: input.groupId,
      description: input.description,
      amountCents: input.amountCents,
      paidByMemberId: input.paidByMemberId,
      date: input.date,
      splitMode: input.split.mode,
      shares: {
        create: [...shares].map(([memberId, shareCents]) => ({ memberId, shareCents })),
      },
    },
    include: { shares: true },
  })
}

/**
 * Deletes an Expense and every ExpenseShare that references it — the share
 * has its own RESTRICT foreign key into Expense, so the expense delete would
 * otherwise fail. Uses the array form of `$transaction` rather than the
 * interactive callback form: the callback's transaction client isn't
 * assignable to the plain `PrismaClient` parameter type this file's other
 * functions use, and these two statements don't need each other's result.
 *
 * `deleteMany` never throws a not-found error — an empty match is a
 * successful no-op — so a P2025 out of this transaction can only have come
 * from the `expense.delete` and means the expense never existed.
 */
export async function deleteExpense(db: PrismaClient, expenseId: string): Promise<void> {
  try {
    await db.$transaction([
      db.expenseShare.deleteMany({ where: { expenseId } }),
      db.expense.delete({ where: { id: expenseId } }),
    ])
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new ExpenseNotFoundError(expenseId)
    }
    throw error
  }
}
