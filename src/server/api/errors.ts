/**
 * The single place that turns any thrown error into an HTTP status and a
 * JSON error body for the REST API. Every HTTP handler funnels its catch
 * block through `toErrorResponse` rather than mapping errors itself, so the
 * status/code contract lives in exactly one spot.
 *
 * Codes are hard-coded string literals per error type, never derived from
 * `error.name` or `error.constructor.name` — renaming a class later must
 * never silently change the wire contract other clients depend on.
 */

import { ZodError } from 'zod'
import { ValidationError } from '../../core/errors.js'
import { GroupNotFoundError, GroupNotEmptyError } from '../db/groups.js'
import { DuplicateMemberError, MemberReferencedError, MemberNotFoundError } from '../db/members.js'
import { ExpenseNotFoundError, MemberNotInGroupError } from '../db/expenses.js'

export interface ErrorBody {
  readonly error: {
    readonly code: string
    readonly message: string
    readonly issues?: unknown
  }
}

export interface ErrorResponse {
  readonly status: number
  readonly body: ErrorBody
}

/**
 * Anything not recognized below — including src/core/settle.ts's plain,
 * un-subclassed Errors thrown for internally corrupted stored data, and any
 * other unrecognized thrown value (even a non-Error) — falls through to
 * this generic 500. The body deliberately never includes the original
 * error's own .message or .stack: those can carry file paths, row ids, or
 * raw SQL fragments that must never reach a client. The real error is still
 * logged server-side so operators can diagnose it.
 */
function internalErrorResponse(error: unknown): ErrorResponse {
  console.error(error)
  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
  }
}

export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: { error: { code: 'VALIDATION_FAILED', message: 'Request validation failed', issues: error.issues } },
    }
  }
  if (error instanceof SyntaxError) {
    // Never echo the caught error's own .message: this branch can't tell a
    // SyntaxError raised while parsing the client's own request body apart
    // from one raised anywhere else in the codebase for an unrelated reason,
    // so it must carry the same no-leak guarantee as internalErrorResponse.
    return { status: 400, body: { error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON' } } }
  }
  if (error instanceof GroupNotFoundError) {
    return { status: 404, body: { error: { code: 'GROUP_NOT_FOUND', message: error.message } } }
  }
  if (error instanceof MemberNotFoundError) {
    return { status: 404, body: { error: { code: 'MEMBER_NOT_FOUND', message: error.message } } }
  }
  if (error instanceof ExpenseNotFoundError) {
    return { status: 404, body: { error: { code: 'EXPENSE_NOT_FOUND', message: error.message } } }
  }
  if (error instanceof DuplicateMemberError) {
    return { status: 409, body: { error: { code: 'DUPLICATE_MEMBER', message: error.message } } }
  }
  if (error instanceof MemberReferencedError) {
    return { status: 409, body: { error: { code: 'MEMBER_REFERENCED', message: error.message } } }
  }
  if (error instanceof GroupNotEmptyError) {
    return { status: 409, body: { error: { code: 'GROUP_NOT_EMPTY', message: error.message } } }
  }
  if (error instanceof ValidationError) {
    return { status: 422, body: { error: { code: 'INVALID_SPLIT', message: error.message } } }
  }
  if (error instanceof MemberNotInGroupError) {
    return { status: 422, body: { error: { code: 'MEMBER_NOT_IN_GROUP', message: error.message } } }
  }
  return internalErrorResponse(error)
}
