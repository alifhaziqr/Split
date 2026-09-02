import { describe, expect, it } from 'vitest'

import {
  toExpenseDto,
  toGroupDetailsDto,
  toGroupDto,
  toMemberDto,
} from '../../../src/server/api/dto.js'
import type { GroupDetails } from '../../../src/server/db/groups.js'

function buildGroupDetails(overrides: Partial<GroupDetails> = {}): GroupDetails {
  return {
    id: 'group-1',
    name: 'Roommates',
    currency: 'USD',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    members: [],
    expenses: [],
    ...overrides,
  }
}

describe('toGroupDto', () => {
  it('maps a group row into a plain GroupDto with an ISO date string', () => {
    const group = {
      id: 'group-1',
      name: 'Roommates',
      currency: 'USD',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }

    const dto = toGroupDto(group)

    expect(dto).toEqual({
      id: 'group-1',
      name: 'Roommates',
      currency: 'USD',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })
})

describe('toMemberDto', () => {
  it('maps a member row into a plain MemberDto with only id and name', () => {
    const member = { id: 'member-1', groupId: 'group-1', name: 'Ana' }

    expect(toMemberDto(member)).toEqual({ id: 'member-1', name: 'Ana' })
  })
})

describe('toExpenseDto', () => {
  it('sorts shares by memberId ascending regardless of input order', () => {
    const expense = {
      id: 'expense-1',
      groupId: 'group-1',
      description: 'Groceries',
      amountCents: 3000,
      paidByMemberId: 'member-1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      splitMode: 'EQUAL' as const,
      createdAt: new Date('2026-01-05T12:00:00.000Z'),
      shares: [
        { id: 'share-c', expenseId: 'expense-1', memberId: 'member-c', shareCents: 1000 },
        { id: 'share-a', expenseId: 'expense-1', memberId: 'member-a', shareCents: 1000 },
        { id: 'share-b', expenseId: 'expense-1', memberId: 'member-b', shareCents: 1000 },
      ],
    }

    const dto = toExpenseDto(expense)

    expect(dto.shares.map(share => share.memberId)).toEqual(['member-a', 'member-b', 'member-c'])
    expect(dto.shares).toEqual([
      { memberId: 'member-a', shareCents: 1000 },
      { memberId: 'member-b', shareCents: 1000 },
      { memberId: 'member-c', shareCents: 1000 },
    ])
  })
})

describe('toGroupDetailsDto', () => {
  it('sorts members alphabetically and expenses by date descending, with exact expected order', () => {
    const details = buildGroupDetails({
      members: [
        { id: 'member-2', groupId: 'group-1', name: 'Charlie' },
        { id: 'member-3', groupId: 'group-1', name: 'Ana' },
        { id: 'member-1', groupId: 'group-1', name: 'Bob' },
      ],
      expenses: [
        {
          id: 'expense-early',
          groupId: 'group-1',
          description: 'Early expense',
          amountCents: 1000,
          paidByMemberId: 'member-1',
          date: new Date('2026-01-01T00:00:00.000Z'),
          splitMode: 'EQUAL' as const,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          shares: [
            { id: 'share-1b', expenseId: 'expense-early', memberId: 'member-2', shareCents: 500 },
            { id: 'share-1a', expenseId: 'expense-early', memberId: 'member-1', shareCents: 500 },
          ],
        },
        {
          id: 'expense-late',
          groupId: 'group-1',
          description: 'Late expense',
          amountCents: 2000,
          paidByMemberId: 'member-2',
          date: new Date('2026-02-01T00:00:00.000Z'),
          splitMode: 'EQUAL' as const,
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
          shares: [
            { id: 'share-2b', expenseId: 'expense-late', memberId: 'member-2', shareCents: 1000 },
            { id: 'share-2a', expenseId: 'expense-late', memberId: 'member-1', shareCents: 1000 },
          ],
        },
      ],
    })

    const dto = toGroupDetailsDto(details)

    expect(dto.members.map(member => member.name)).toEqual(['Ana', 'Bob', 'Charlie'])
    expect(dto.expenses.map(expense => expense.id)).toEqual(['expense-late', 'expense-early'])
    expect(dto.expenses[0]?.shares.map(share => share.memberId)).toEqual(['member-1', 'member-2'])
    expect(dto.expenses[1]?.shares.map(share => share.memberId)).toEqual(['member-1', 'member-2'])
  })

  it('produces byte-identical JSON for the same logical data listed in a different input order', () => {
    const membersA = [
      { id: 'member-2', groupId: 'group-1', name: 'Charlie' },
      { id: 'member-3', groupId: 'group-1', name: 'Ana' },
      { id: 'member-1', groupId: 'group-1', name: 'Bob' },
    ]
    const membersB = [
      { id: 'member-1', groupId: 'group-1', name: 'Bob' },
      { id: 'member-2', groupId: 'group-1', name: 'Charlie' },
      { id: 'member-3', groupId: 'group-1', name: 'Ana' },
    ]

    const expenseEarly = {
      id: 'expense-early',
      groupId: 'group-1',
      description: 'Early expense',
      amountCents: 1000,
      paidByMemberId: 'member-1',
      date: new Date('2026-01-01T00:00:00.000Z'),
      splitMode: 'EQUAL' as const,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      shares: [
        { id: 'share-1b', expenseId: 'expense-early', memberId: 'member-2', shareCents: 500 },
        { id: 'share-1a', expenseId: 'expense-early', memberId: 'member-1', shareCents: 500 },
      ],
    }
    const expenseLate = {
      id: 'expense-late',
      groupId: 'group-1',
      description: 'Late expense',
      amountCents: 2000,
      paidByMemberId: 'member-2',
      date: new Date('2026-02-01T00:00:00.000Z'),
      splitMode: 'EQUAL' as const,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      shares: [
        { id: 'share-2a', expenseId: 'expense-late', memberId: 'member-1', shareCents: 1000 },
        { id: 'share-2b', expenseId: 'expense-late', memberId: 'member-2', shareCents: 1000 },
      ],
    }

    const detailsA = buildGroupDetails({ members: membersA, expenses: [expenseEarly, expenseLate] })
    const detailsB = buildGroupDetails({ members: membersB, expenses: [expenseLate, expenseEarly] })

    expect(JSON.stringify(toGroupDetailsDto(detailsA))).toBe(JSON.stringify(toGroupDetailsDto(detailsB)))
  })

  it('breaks ties on identical expense dates by ordering ids ascending', () => {
    const sameDate = new Date('2026-03-01T00:00:00.000Z')
    const details = buildGroupDetails({
      members: [{ id: 'member-1', groupId: 'group-1', name: 'Ana' }],
      expenses: [
        {
          id: 'expense-z',
          groupId: 'group-1',
          description: 'Second alphabetically last id',
          amountCents: 1000,
          paidByMemberId: 'member-1',
          date: sameDate,
          splitMode: 'EQUAL' as const,
          createdAt: sameDate,
          shares: [],
        },
        {
          id: 'expense-a',
          groupId: 'group-1',
          description: 'First alphabetically first id',
          amountCents: 500,
          paidByMemberId: 'member-1',
          date: sameDate,
          splitMode: 'EQUAL' as const,
          createdAt: sameDate,
          shares: [],
        },
      ],
    })

    const dto = toGroupDetailsDto(details)

    expect(dto.expenses.map(expense => expense.id)).toEqual(['expense-a', 'expense-z'])
  })

  it('converts every Date field to a string that round-trips to the same instant', () => {
    const groupCreatedAt = new Date('2026-01-01T08:30:00.000Z')
    const expenseDate = new Date('2026-01-05T00:00:00.000Z')
    const expenseCreatedAt = new Date('2026-01-05T12:34:56.000Z')

    const details = buildGroupDetails({
      createdAt: groupCreatedAt,
      members: [{ id: 'member-1', groupId: 'group-1', name: 'Ana' }],
      expenses: [
        {
          id: 'expense-1',
          groupId: 'group-1',
          description: 'Groceries',
          amountCents: 1000,
          paidByMemberId: 'member-1',
          date: expenseDate,
          splitMode: 'EQUAL' as const,
          createdAt: expenseCreatedAt,
          shares: [],
        },
      ],
    })

    const dto = toGroupDetailsDto(details)

    expect(typeof dto.createdAt).toBe('string')
    expect(typeof dto.expenses[0]?.date).toBe('string')
    expect(typeof dto.expenses[0]?.createdAt).toBe('string')

    expect(new Date(dto.createdAt).getTime()).toBe(groupCreatedAt.getTime())
    expect(new Date(dto.expenses[0]?.date ?? '').getTime()).toBe(expenseDate.getTime())
    expect(new Date(dto.expenses[0]?.createdAt ?? '').getTime()).toBe(expenseCreatedAt.getTime())
  })
})
