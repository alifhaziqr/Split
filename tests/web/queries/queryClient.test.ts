import { describe, expect, it } from 'vitest'

import { ApiError } from '../../../src/web/net/apiError.js'
import { createQueryClient } from '../../../src/web/queries/queryClient.js'

describe('createQueryClient', () => {
  it('never retries a 4xx ApiError — a GROUP_NOT_FOUND should surface after one round trip', () => {
    const client = createQueryClient()
    const retry = client.getDefaultOptions().queries?.retry as (
      count: number,
      error: unknown,
    ) => boolean

    expect(retry(0, new ApiError(404, 'GROUP_NOT_FOUND', 'gone'))).toBe(false)
    expect(retry(0, new ApiError(409, 'DUPLICATE_MEMBER', 'dup'))).toBe(false)
  })

  it('retries a 5xx or network ApiError up to twice', () => {
    const client = createQueryClient()
    const retry = client.getDefaultOptions().queries?.retry as (
      count: number,
      error: unknown,
    ) => boolean

    expect(retry(0, new ApiError(500, 'INTERNAL_ERROR', 'boom'))).toBe(true)
    expect(retry(1, new ApiError(500, 'INTERNAL_ERROR', 'boom'))).toBe(true)
    expect(retry(2, new ApiError(500, 'INTERNAL_ERROR', 'boom'))).toBe(false)
    expect(retry(0, new ApiError(0, 'NETWORK_ERROR', 'offline'))).toBe(true)
  })

  it('never retries mutations — POST/DELETE are not safely retryable here', () => {
    const client = createQueryClient()

    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  })

  it('does not refetch on window focus, and treats data as stale immediately', () => {
    const client = createQueryClient()
    const queries = client.getDefaultOptions().queries

    expect(queries?.refetchOnWindowFocus).toBe(false)
    expect(queries?.staleTime).toBe(0)
  })
})
