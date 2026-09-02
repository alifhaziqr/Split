import { describe, expect, it, vi } from 'vitest'

import { createRequest } from '../../../src/web/net/http.js'
import { ApiError } from '../../../src/web/net/apiError.js'
import type { FetchLike } from '../../../src/web/net/http.js'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('createRequest', () => {
  it('sends no body and no Content-Type on a GET', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(200, { ok: true }))
    const request = createRequest(fetchMock)

    await request('GET', '/api/groups')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/groups')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect((init.headers as Record<string, string> | undefined)?.['content-type']).toBeUndefined()
  })

  it('serializes a body and sets Content-Type on a POST', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(201, { id: 'g1' }))
    const request = createRequest(fetchMock)

    await request('POST', '/api/groups', { name: 'Trip', currency: 'USD' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: 'Trip', currency: 'USD' }))
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')
  })

  it('resolves a 200 JSON response to the parsed body', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => jsonResponse(200, { groups: [] }))
    const request = createRequest(fetchMock)

    const result = await request<{ groups: unknown[] }>('GET', '/api/groups')

    expect(result).toEqual({ groups: [] })
  })

  it('resolves a 204 No Content response to undefined without parsing a body', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(null, { status: 204 }))
    const request = createRequest(fetchMock)

    const result = await request('DELETE', '/api/groups/g1')

    expect(result).toBeUndefined()
  })

  it('throws an ApiError built from a conforming {error:{code,message}} body', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      jsonResponse(409, { error: { code: 'DUPLICATE_MEMBER', message: 'Ana already exists' } }),
    )
    const request = createRequest(fetchMock)

    await expect(request('POST', '/api/groups/g1/members', { name: 'Ana' })).rejects.toMatchObject({
      status: 409,
      code: 'DUPLICATE_MEMBER',
      message: 'Ana already exists',
    })
  })

  it('throws an ApiError, not a raw SyntaxError, when a 2xx response body is not valid JSON', async () => {
    // The module's own header comment promises "ApiError thrown on any
    // failure" — a route that unexpectedly returns a non-JSON 200 body
    // must not leak a raw parse exception past that contract.
    const fetchMock = vi.fn<FetchLike>(async () => new Response('not json', { status: 200 }))
    const request = createRequest(fetchMock)

    await expect(request('GET', '/api/groups')).rejects.toMatchObject({ status: 200, code: 'INTERNAL_ERROR' })
  })

  it('throws an INTERNAL_ERROR ApiError when a non-2xx body does not match the error shape', async () => {
    // e.g. a proxy's own HTML 502, not anything toErrorResponse produced.
    const fetchMock = vi.fn<FetchLike>(async () => new Response('<html>Bad Gateway</html>', { status: 502 }))
    const request = createRequest(fetchMock)

    await expect(request('GET', '/api/groups')).rejects.toMatchObject({
      status: 502,
      code: 'INTERNAL_ERROR',
    })
  })

  it('throws a NETWORK_ERROR ApiError when fetch itself rejects', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const request = createRequest(fetchMock)

    await expect(request('GET', '/api/groups')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    })
  })

  it('re-throws an ApiError unwrapped rather than double-wrapping it', async () => {
    const fetchMock = vi.fn<FetchLike>(async () =>
      jsonResponse(404, { error: { code: 'GROUP_NOT_FOUND', message: 'gone' } }),
    )
    const request = createRequest(fetchMock)

    try {
      await request('GET', '/api/groups/missing')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).code).toBe('GROUP_NOT_FOUND')
    }
  })
})
