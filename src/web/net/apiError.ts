/**
 * The client's copy of src/server/api/errors.ts's status/code contract — see
 * that file for the authoritative table. Every failure the app can hit,
 * from an HTTP error body to a rejected fetch, becomes exactly this one type.
 */

export const API_ERROR_CODES = [
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
  'NOT_FOUND', // app.ts's notFound handler, for a route that doesn't exist at all.
  'NETWORK_ERROR', // Client-only: fetch itself rejected (offline, DNS, ...). The
  // server can never send this code.
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

function isKnownCode(code: string): code is ApiErrorCode {
  return (API_ERROR_CODES as readonly string[]).includes(code)
}

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly issues: unknown

  constructor(status: number, code: string, message: string, issues?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    // A code the client hasn't been taught about yet (the server adds one
    // after this client shipped) narrows to INTERNAL_ERROR rather than
    // widening ApiErrorCode — that's what keeps errorMessages.ts's exhaustive
    // switch a real guarantee instead of an aspiration.
    this.code = isKnownCode(code) ? code : 'INTERNAL_ERROR'
    this.issues = issues
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
