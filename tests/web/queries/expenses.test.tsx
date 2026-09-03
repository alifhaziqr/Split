import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useCreateExpense, useDeleteExpense } from '../../../src/web/queries/expenses.js'
import { groupKeys } from '../../../src/web/queries/queryKeys.js'
import { createFetchStub } from '../fetchStub.js'
import { createProvidersWrapper } from '../renderWithProviders.js'

const EQUAL_BODY = {
  description: 'Dinner',
  amountCents: 1000,
  paidByMemberId: 'm1',
  date: '2026-09-02',
  split: { mode: 'EQUAL' as const, memberIds: ['m1', 'm2'] },
}

describe('useCreateExpense', () => {
  it('invalidates the group detail (which prefix-covers settlement)', async () => {
    const stub = createFetchStub()
    stub.queueResponse('POST', '/api/groups/g1/expenses', {
      status: 201,
      body: { id: 'e1' },
    })
    const { Wrapper, queryClient } = createProvidersWrapper({ fetch: stub.fetch })
    queryClient.setQueryData(groupKeys.detail('g1'), {
      id: 'g1',
      members: [],
      expenses: [],
    })

    const { result } = renderHook(() => useCreateExpense('g1'), { wrapper: Wrapper })
    result.current.mutate(EQUAL_BODY)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryState(groupKeys.detail('g1'))?.isInvalidated).toBe(true)
  })
})

describe('useDeleteExpense', () => {
  it("takes {expenseId, groupId} and invalidates that group's detail — DELETE carries no groupId of its own", async () => {
    const stub = createFetchStub()
    stub.queueResponse('DELETE', '/api/expenses/e1', { status: 204 })
    const { Wrapper, queryClient } = createProvidersWrapper({ fetch: stub.fetch })
    queryClient.setQueryData(groupKeys.detail('g1'), {
      id: 'g1',
      members: [],
      expenses: [],
    })

    const { result } = renderHook(() => useDeleteExpense(), { wrapper: Wrapper })
    result.current.mutate({ expenseId: 'e1', groupId: 'g1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryState(groupKeys.detail('g1'))?.isInvalidated).toBe(true)
    // The URL sent must be group-agnostic — the id alone is enough.
    expect(stub.calls[0]?.path).toBe('/api/expenses/e1')
  })
})
