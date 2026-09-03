import type { SplitMode } from '../../core/split.js'
import type {
  Expense,
  ExpenseShare,
  Group,
  Member,
} from '../../generated/prisma/client.js'
import type { GroupDetails } from '../db/groups.js'

export interface MemberDto {
  readonly id: string
  readonly name: string
}

export interface ExpenseShareDto {
  readonly memberId: string
  readonly shareCents: number
}

export interface ExpenseDto {
  readonly id: string
  readonly description: string
  readonly amountCents: number
  readonly paidByMemberId: string
  readonly date: string
  readonly splitMode: SplitMode
  readonly createdAt: string
  readonly shares: readonly ExpenseShareDto[]
}

export interface GroupDto {
  readonly id: string
  readonly name: string
  readonly currency: string
  readonly createdAt: string
}

export interface GroupDetailsDto extends GroupDto {
  readonly members: readonly MemberDto[]
  readonly expenses: readonly ExpenseDto[]
}

export function toGroupDto(group: Group): GroupDto {
  return {
    id: group.id,
    name: group.name,
    currency: group.currency,
    createdAt: group.createdAt.toISOString(),
  }
}

export function toMemberDto(member: Member): MemberDto {
  return {
    id: member.id,
    name: member.name,
  }
}

function toExpenseShareDto(share: ExpenseShare): ExpenseShareDto {
  return {
    memberId: share.memberId,
    shareCents: share.shareCents,
  }
}

export function toExpenseDto(expense: Expense & { shares: ExpenseShare[] }): ExpenseDto {
  const sortedShares = [...expense.shares].sort((a, b) =>
    a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0,
  )

  return {
    id: expense.id,
    description: expense.description,
    amountCents: expense.amountCents,
    paidByMemberId: expense.paidByMemberId,
    date: expense.date.toISOString(),
    splitMode: expense.splitMode,
    createdAt: expense.createdAt.toISOString(),
    shares: sortedShares.map(toExpenseShareDto),
  }
}

export function toGroupDetailsDto(details: GroupDetails): GroupDetailsDto {
  const sortedMembers = [...details.members].sort((a, b) => {
    if (a.name < b.name) return -1
    if (a.name > b.name) return 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  const sortedExpenses = [...details.expenses].sort((a, b) => {
    const dateDiff = b.date.getTime() - a.date.getTime()
    if (dateDiff !== 0) return dateDiff
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  return {
    ...toGroupDto(details),
    members: sortedMembers.map(toMemberDto),
    expenses: sortedExpenses.map(toExpenseDto),
  }
}
