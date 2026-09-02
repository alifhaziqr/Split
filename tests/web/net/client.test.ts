import { describe, expect, it, vi } from 'vitest'

import { createApiClient } from '../../../src/web/net/client.js'
import type { FetchLike } from '../../../src/web/net/http.js'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function makeClient(fetchImpl: FetchLike) {
  return createApiClient({ fetch: fetchImpl })
}

describe('createApiClient', () => {
  it('createGroup: POST /api/groups with the given body', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(201, { id: 'g1' }))
    const client = makeClient(fetchMock)

    const result = await client.createGroup({ name: 'Trip', currency: 'USD' })

    expect(result).toEqual({ id: 'g1' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/groups')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: 'Trip', currency: 'USD' }))
  })

  it('listGroups: GET /api/groups', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(200, { groups: [] }))
    const client = makeClient(fetchMock)

    await client.listGroups()

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/groups')
    expect(init.method).toBe('GET')
  })

  it('getGroup: GET /api/groups/:groupId, with the id interpolated', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(200, { id: 'g1' }))
    const client = makeClient(fetchMock)

    await client.getGroup('g1')

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/groups/g1')
  })

  it('deleteGroup: DELETE /api/groups/:groupId', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(null, { status: 204 }))
    const client = makeClient(fetchMock)

    const result = await client.deleteGroup('g1')

    expect(result).toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/groups/g1')
    expect(init.method).toBe('DELETE')
  })

  it('addMember: POST /api/groups/:groupId/members with the given body', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(201, { id: 'm1', name: 'Ana' }))
    const client = makeClient(fetchMock)

    await client.addMember('g1', { name: 'Ana' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/groups/g1/members')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: 'Ana' }))
  })

  it('deleteMember: DELETE /api/groups/:groupId/members/:memberId', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(null, { status: 204 }))
    const client = makeClient(fetchMock)

    await client.deleteMember('g1', 'm1')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/groups/g1/members/m1')
    expect(init.method).toBe('DELETE')
  })

  it('createExpense: POST /api/groups/:groupId/expenses with the given body', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(201, { id: 'e1' }))
    const client = makeClient(fetchMock)
    const body = {
      description: 'Dinner',
      amountCents: 1000,
      paidByMemberId: 'm1',
      date: '2026-09-02',
      split: { mode: 'EQUAL' as const, memberIds: ['m1', 'm2'] },
    }

    await client.createExpense('g1', body)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/groups/g1/expenses')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify(body))
  })

  it('deleteExpense: DELETE /api/expenses/:expenseId — not nested under a group', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(null, { status: 204 }))
    const client = makeClient(fetchMock)

    await client.deleteExpense('e1')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/expenses/e1')
    expect(init.method).toBe('DELETE')
  })

  it('getSettlement: GET /api/groups/:groupId/settlement', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(200, { balances: [], transfers: [] }))
    const client = makeClient(fetchMock)

    await client.getSettlement('g1')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/groups/g1/settlement')
    expect(init.method).toBe('GET')
  })

  it('defaults to globalThis.fetch when no fetch is injected', () => {
    // Not exercised end-to-end here (that would hit the network); this just
    // proves the factory doesn't require the option.
    expect(() => createApiClient()).not.toThrow()
  })
})
