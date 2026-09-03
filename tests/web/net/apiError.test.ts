import { describe, expect, it } from 'vitest'

import { ApiError, isApiError } from '../../../src/web/net/apiError.js'

describe('ApiError', () => {
  it('carries status, a known code, message, and issues', () => {
    const error = new ApiError(409, 'DUPLICATE_MEMBER', 'Ana already exists', [
      { path: ['name'] },
    ])

    expect(error).toBeInstanceOf(Error)
    expect(error.status).toBe(409)
    expect(error.code).toBe('DUPLICATE_MEMBER')
    expect(error.message).toBe('Ana already exists')
    expect(error.issues).toEqual([{ path: ['name'] }])
  })

  it('narrows an unrecognized wire code to INTERNAL_ERROR rather than widening the type', () => {
    // A future server code the client hasn't been taught about yet must not
    // become a value ApiErrorCode's exhaustive switches (errorMessages.ts)
    // can't handle.
    const error = new ApiError(418, 'SOMETHING_NEW_THE_SERVER_ADDED', 'teapot')

    expect(error.code).toBe('INTERNAL_ERROR')
  })

  it('has no issues by default', () => {
    const error = new ApiError(500, 'INTERNAL_ERROR', 'boom')

    expect(error.issues).toBeUndefined()
  })

  it('recognizes every documented server error code, plus the client-only ones', () => {
    const serverCodes = [
      'VALIDATION_FAILED',
      'MALFORMED_JSON',
      'GROUP_NOT_FOUND',
      'MEMBER_NOT_FOUND',
      'EXPENSE_NOT_FOUND',
      'DUPLICATE_MEMBER',
      'MEMBER_REFERENCED',
      'GROUP_NOT_EMPTY',
      'INVALID_SPLIT',
      'MEMBER_NOT_IN_GROUP',
      'INTERNAL_ERROR',
      'NOT_FOUND', // app.ts's notFound handler for unmatched routes
    ]

    for (const code of serverCodes) {
      expect(new ApiError(400, code, 'x').code).toBe(code)
    }
  })
})

describe('isApiError', () => {
  it('narrows an ApiError', () => {
    const value: unknown = new ApiError(404, 'GROUP_NOT_FOUND', 'gone')

    expect(isApiError(value)).toBe(true)
  })

  it('rejects a plain Error and non-error values', () => {
    expect(isApiError(new Error('plain'))).toBe(false)
    expect(isApiError('a string')).toBe(false)
    expect(isApiError(null)).toBe(false)
    expect(isApiError(undefined)).toBe(false)
  })
})
