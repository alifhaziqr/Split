/**
 * Every user-facing sentence for an ApiErrorCode, in one exhaustive switch
 * ending in a `never` check. That's what turns "the server added a new
 * error code" into a `tsc` failure here rather than a silently generic
 * message reaching a user — the only mechanism that will actually catch it.
 */

import type { ApiErrorCode } from '../net/apiError.js'

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

export function errorMessageFor(code: ApiErrorCode): string {
  switch (code) {
    case 'GROUP_NOT_FOUND':
      return 'This group no longer exists.'
    case 'MEMBER_NOT_FOUND':
      return 'This member no longer exists.'
    case 'EXPENSE_NOT_FOUND':
      return 'This expense no longer exists.'
    case 'DUPLICATE_MEMBER':
      return 'Someone in this group already has that name.'
    case 'MEMBER_REFERENCED':
      return 'This member is on one or more expenses — remove those first.'
    case 'GROUP_NOT_EMPTY':
      return 'This group still has members or expenses — remove those first.'
    case 'INVALID_SPLIT':
      return "This expense's split doesn't add up. Please check the amounts."
    case 'MEMBER_NOT_IN_GROUP':
      return 'One of the selected members is no longer in this group.'
    // These four mean the client built a bad request, the connection never
    // reached the server, or the server failed unexpectedly — none of which
    // the user can act on, so they get the same generic copy rather than a
    // sentence implying there's something specific to fix.
    case 'VALIDATION_FAILED':
    case 'MALFORMED_JSON':
    case 'NOT_FOUND':
    case 'INTERNAL_ERROR':
      return GENERIC_MESSAGE
    case 'NETWORK_ERROR':
      return "Couldn't reach the server. Check your connection and try again."
    default: {
      const exhaustive: never = code
      return exhaustive
    }
  }
}
