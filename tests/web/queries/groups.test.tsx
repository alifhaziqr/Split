import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useCreateGroup, useDeleteGroup, useGroupQuery, useGroupsQuery } from '../../../src/web/queries/groups.js'
import { groupKeys } from '../../../src/web/queries/queryKeys.js'
import { createFetchStub } from '../fetchStub.js'
import { createProvidersWrapper } from '../renderWithProviders.js'

describe('useCreateGroup', () => {
  it('invalidates the group list on success', async () => {
    const stub = createFetchStub()
    stub.queueResponse('POST', '/api/groups', { status: 201, body: { id: 'g1', name: 'Trip', currency: 'USD' } })
    const { Wrapper, queryClient } = createProvidersWrapper({ fetch: stub.fetch })
    // Seed the list query so we can observe it become stale/invalidated.
    queryClient.setQueryData(groupKeys.list(), { groups: [] })

    const { result } = renderHook(() => useCreateGroup(), { wrapper: Wrapper })
    result.current.mutate({ name: 'Trip', currency: 'USD' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryState(groupKeys.list())?.isInvalidated).toBe(true)
  })

  it('does not seed a detail cache entry — POST /api/groups returns a GroupDto with no members/expenses', async () => {
    const stub = createFetchStub()
    stub.queueResponse('POST', '/api/groups', { status: 201, body: { id: 'g1', name: 'Trip', currency: 'USD' } })
    const { Wrapper, queryClient } = createProvidersWrapper({ fetch: stub.fetch })

    const { result } = renderHook(() => useCreateGroup(), { wrapper: Wrapper })
    result.current.mutate({ name: 'Trip', currency: 'USD' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(groupKeys.detail('g1'))).toBeUndefined()
  })
})

describe('useDeleteGroup', () => {
  it('invalidates the list and REMOVES (not invalidates) the deleted group\'s detail cache entry', async () => {
    const stub = createFetchStub()
    stub.queueResponse('DELETE', '/api/groups/g1', { status: 204 })
    const { Wrapper, queryClient } = createProvidersWrapper({ fetch: stub.fetch })
    queryClient.setQueryData(groupKeys.list(), { groups: [{ id: 'g1' }] })
    queryClient.setQueryData(groupKeys.detail('g1'), { id: 'g1', members: [], expenses: [] })

    const { result } = renderHook(() => useDeleteGroup(), { wrapper: Wrapper })
    result.current.mutate('g1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryState(groupKeys.list())?.isInvalidated).toBe(true)
    // Removed entirely, not merely marked stale — a stale entry would
    // refetch straight into a 404 and flash an error on the way out.
    expect(queryClient.getQueryState(groupKeys.detail('g1'))).toBeUndefined()
  })
})

describe('useGroupsQuery / useGroupQuery', () => {
  it('fetches the group list', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups', { status: 200, body: { groups: [{ id: 'g1', name: 'Trip' }] } })
    const { Wrapper } = createProvidersWrapper({ fetch: stub.fetch })

    const { result } = renderHook(() => useGroupsQuery(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ groups: [{ id: 'g1', name: 'Trip' }] })
  })

  it('fetches one group\'s details', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups/g1', { status: 200, body: { id: 'g1', members: [], expenses: [] } })
    const { Wrapper } = createProvidersWrapper({ fetch: stub.fetch })

    const { result } = renderHook(() => useGroupQuery('g1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ id: 'g1', members: [], expenses: [] })
  })
})
