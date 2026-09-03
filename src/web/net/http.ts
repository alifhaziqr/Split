/**
 * The one fetch wrapper in the app. JSON in, a typed value out, ApiError
 * thrown on any failure — every call site in net/client.ts goes through
 * this and nowhere else touches `fetch` directly.
 *
 * `createRequest` takes its fetch implementation as an argument rather than
 * reading `globalThis.fetch`, matching every existing seam in this repo
 * (createApp(db), createDbClient(url), createHttpClient(getApp)). That is
 * what lets tests inject vi.fn<FetchLike>() with no global mutation to leak
 * between them, and lets the contract test inject the real Hono app's
 * app.request as the fetch implementation.
 */

import { ApiError } from './apiError.js'

export type FetchLike = typeof globalThis.fetch

interface WireErrorBody {
  readonly error: {
    readonly code: string
    readonly message: string
    readonly issues?: unknown
  }
}

/** True only for the exact `{error:{code,message}}` shape errors.ts always produces. */
function isWireErrorBody(value: unknown): value is WireErrorBody {
  if (value === null || typeof value !== 'object') return false
  const error = (value as Record<string, unknown>).error
  if (error === null || typeof error !== 'object') return false
  const { code, message } = error as Record<string, unknown>
  return typeof code === 'string' && typeof message === 'string'
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = undefined
  }

  if (isWireErrorBody(body)) {
    return new ApiError(
      response.status,
      body.error.code,
      body.error.message,
      body.error.issues,
    )
  }

  // Not a body toErrorResponse produced — a proxy's own error page, an empty
  // body, or anything else unexpected. Never echo it back; see errors.ts's
  // own no-leak rule for the same reasoning.
  return new ApiError(response.status, 'INTERNAL_ERROR', 'An unexpected error occurred')
}

export function createRequest(fetchImpl: FetchLike) {
  return async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    let response: Response
    try {
      response = await fetchImpl(path, {
        method,
        // Never send a body (or a Content-Type header) on a GET/DELETE with
        // nothing to serialize.
        ...(body !== undefined && {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      })
    } catch {
      // fetch itself rejected: offline, DNS, a blocked request. status 0 is
      // not a real HTTP status; it marks "no response was ever received".
      throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server')
    }

    if (!response.ok) {
      throw await toApiError(response)
    }

    // Three of the nine endpoints return 204 No Content; response.json() on
    // an empty body throws, so this must be checked before parsing.
    if (response.status === 204) {
      return undefined as T
    }

    try {
      return (await response.json()) as T
    } catch {
      // A 2xx with a non-JSON body is a server bug, not a client error —
      // but this module's contract is "ApiError thrown on any failure", so
      // even that must not leak a raw SyntaxError past it.
      throw new ApiError(
        response.status,
        'INTERNAL_ERROR',
        'An unexpected error occurred',
      )
    }
  }
}
