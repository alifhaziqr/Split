import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useAddMember, useDeleteMember } from '../../../src/web/queries/members.js'
import { groupKeys } from '../../../src/web/queries/queryKeys.js'
import { useSettlementQuery } from '../../../src/web/queries/settlement.js'
import { createFetchStub } from '../fetchStub.js'
import { createProvidersWrapper } from '../renderWithProviders.js'

describe('useAddMember', () => {
  it('invalidates the group detail, and a settlement query mounted under it refetches too', async () => {
    // This is the test that proves the queryKeys.ts prefix design actually
    // works end to end, not just that the keys look right in isolation.
    const stub = createFetchStub()
    stub.queueResponse('POST', '/api/groups/g1/members', { status: 201, body: { id: 'm2', name: 'Bob' } })
    stub.queueResponse('GET', '/api/groups/g1/settlement', {
      status: 200,
      body: { balances: [{ memberId: 'm1', balanceCents: 0 }], transfers: [] },
    })
    const { Wrapper, queryClient } = createProvidersWrapper({ fetch: stub.fetch })
    queryClient.setQueryData(groupKeys.detail('g1'), { id: 'g1', members: [], expenses: [] })

    const settlement = renderHook(() => useSettlementQuery('g1'), { wrapper: Wrapper })
    await waitFor(() => expect(settlement.result.current.isSuccess).toBe(true))
    const settlementCallCountAfterMount = stub.calls.filter((c) => c.path === '/api/groups/g1/settlement').length
    expect(settlementCallCountAfterMount).toBe(1)

    const addMember = renderHook(() => useAddMember('g1'), { wrapper: Wrapper })
    addMember.result.current.mutate({ name: 'Bob' })

    await waitFor(() => expect(addMember.result.current.isSuccess).toBe(true))
    // The settlement query was never mutated directly — it's mounted under
    // groupKeys.settlement('g1'), and only refetches because that key is a
    // prefix match under groupKeys.detail('g1'). Query state's own
    // isInvalidated flag flips back to false as soon as the (near-instant,
    // staleTime: 0) refetch completes, so the real proof is a second fetch
    // actually happening — not the transient flag.
    await waitFor(() => {
      const count = stub.calls.filter((c) => c.path === '/api/groups/g1/settlement').length
      expect(count).toBeGreaterThan(settlementCallCountAfterMount)
    })
  })
})

describe('useDeleteMember', () => {
  it('invalidates the group detail (which prefix-covers settlement)', async () => {
    const stub = createFetchStub()
    stub.queueResponse('DELETE', '/api/groups/g1/members/m2', { status: 204 })
    const { Wrapper, queryClient } = createProvidersWrapper({ fetch: stub.fetch })
    queryClient.setQueryData(groupKeys.detail('g1'), { id: 'g1', members: [], expenses: [] })

    const { result } = renderHook(() => useDeleteMember('g1'), { wrapper: Wrapper })
    result.current.mutate('m2')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryState(groupKeys.detail('g1'))?.isInvalidated).toBe(true)
  })
})
