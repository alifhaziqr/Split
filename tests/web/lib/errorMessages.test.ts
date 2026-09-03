import { describe, expect, it } from 'vitest'
import { errorMessageFor } from '../../../src/web/lib/errorMessages.js'
import { API_ERROR_CODES } from '../../../src/web/net/apiError.js'

describe('errorMessageFor', () => {
  it('maps every documented ApiErrorCode to a non-empty, non-generic sentence', () => {
    // Iterating the codes array (rather than hard-coding each one) means
    // this test grows itself the moment a new code is added to
    // apiError.ts — exactly the guarantee errorMessages.ts's exhaustive
    // switch is meant to provide.
    const genericCodes = new Set([
      'INTERNAL_ERROR',
      'NETWORK_ERROR',
      'NOT_FOUND',
      'VALIDATION_FAILED',
      'MALFORMED_JSON',
    ])

    for (const code of API_ERROR_CODES) {
      const message = errorMessageFor(code)
      expect(message.length).toBeGreaterThan(0)
      if (!genericCodes.has(code)) {
        // A user-reachable code (DUPLICATE_MEMBER, GROUP_NOT_FOUND, ...)
        // should say something specific, not just echo "something went wrong".
        expect(message.toLowerCase()).not.toBe('something went wrong')
      }
    }
  })

  it('gives DUPLICATE_MEMBER a sentence naming the actual problem', () => {
    expect(errorMessageFor('DUPLICATE_MEMBER')).toMatch(/already/i)
  })

  it('gives GROUP_NOT_EMPTY a sentence naming the actual problem', () => {
    expect(errorMessageFor('GROUP_NOT_EMPTY')).toMatch(/members|expenses/i)
  })
})
