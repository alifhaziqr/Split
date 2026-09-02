/**
 * A hand-rolled fetch stub, queued by "METHOD /path", used in place of MSW —
 * no new dependency, no service-worker/node-interceptor machinery, and it
 * matches how tests/server/api/httpTestHelpers.ts already hand-rolls its own
 * HTTP test helper. Not named *.test.ts, so vitest never collects it as a
 * suite of its own.
 */

import type { FetchLike } from '../../src/web/net/http.js'

export interface StubbedResponse {
  readonly status: number
  readonly body?: unknown
}

export interface RecordedCall {
  readonly method: string
  readonly path: string
  readonly body: unknown
}

function key(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`
}

export function createFetchStub() {
  const queue = new Map<string, StubbedResponse[]>()
  const calls: RecordedCall[] = []

  function queueResponse(method: string, path: string, response: StubbedResponse): void {
    const k = key(method, path)
    const existing = queue.get(k) ?? []
    existing.push(response)
    queue.set(k, existing)
  }

  const fetch: FetchLike = async (input, init) => {
    const path = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    let parsedBody: unknown
    if (typeof init?.body === 'string') {
      try {
        parsedBody = JSON.parse(init.body) as unknown
      } catch {
        parsedBody = init.body
      }
    }
    calls.push({ method, path, body: parsedBody })

    const k = key(method, path)
    const responses = queue.get(k)
    const nextResponse = responses?.[0]
    if (responses === undefined || nextResponse === undefined) {
      throw new Error(`fetchStub: no queued response for ${k}`)
    }
    // Multiple queued responses are consumed in order (a retry or a
    // before/after pair); a single queued response is reused for every
    // matching call, which is the common case (e.g. a refetch after
    // invalidation hitting the same canned detail response again).
    if (responses.length > 1) {
      responses.shift()
    }

    if (nextResponse.body === undefined) {
      return new Response(null, { status: nextResponse.status })
    }
    return new Response(JSON.stringify(nextResponse.body), {
      status: nextResponse.status,
      headers: { 'content-type': 'application/json' },
    })
  }

  return { fetch, queueResponse, calls }
}
