import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ValidationError } from '../../../src/core/errors.js'
import { toErrorResponse } from '../../../src/server/api/errors.js'
import {
  ExpenseNotFoundError,
  MemberNotInGroupError,
} from '../../../src/server/db/expenses.js'
import { GroupNotEmptyError, GroupNotFoundError } from '../../../src/server/db/groups.js'
import {
  DuplicateMemberError,
  MemberNotFoundError,
  MemberReferencedError,
} from '../../../src/server/db/members.js'

describe('toErrorResponse', () => {
  it('maps a real ZodError to 400 VALIDATION_FAILED with issues attached', () => {
    const result = z.string().safeParse(123)
    const zodError = result.error
    if (!zodError) throw new Error('expected safeParse to fail')

    const { status, body } = toErrorResponse(zodError)

    expect(status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_FAILED')
    expect(Array.isArray(body.error.issues)).toBe(true)
    expect((body.error.issues as unknown[]).length).toBeGreaterThan(0)
  })

  it('maps a real SyntaxError from malformed JSON to 400 MALFORMED_JSON', () => {
    let syntaxError: unknown
    try {
      JSON.parse('{not valid json')
    } catch (error) {
      syntaxError = error
    }
    expect(syntaxError).toBeInstanceOf(SyntaxError)

    const { status, body } = toErrorResponse(syntaxError)

    expect(status).toBe(400)
    expect(body.error.code).toBe('MALFORMED_JSON')
  })

  it("never echoes a SyntaxError instance's own message into the response body", () => {
    // toErrorResponse cannot tell a SyntaxError raised while parsing the
    // client's own request body apart from one raised anywhere else in the
    // codebase for an unrelated reason — V8's JSON.parse errors describe only
    // a token/position and happen to be harmless today, but this branch must
    // not rely on that; it should behave exactly like the generic 500 branch
    // and never repeat a caught error's own message back to the client.
    const syntaxError = new SyntaxError(
      '/home/afrina/split/dev.db: internal detail that must never reach a client',
    )

    const { body } = toErrorResponse(syntaxError)

    expect(JSON.stringify(body)).not.toContain('/home/afrina/split/dev.db')
  })

  it('maps GroupNotFoundError to 404 GROUP_NOT_FOUND', () => {
    const { status, body } = toErrorResponse(new GroupNotFoundError('g1'))
    expect(status).toBe(404)
    expect(body.error.code).toBe('GROUP_NOT_FOUND')
  })

  it('maps MemberNotFoundError to 404 MEMBER_NOT_FOUND', () => {
    const { status, body } = toErrorResponse(new MemberNotFoundError('m1'))
    expect(status).toBe(404)
    expect(body.error.code).toBe('MEMBER_NOT_FOUND')
  })

  it('maps ExpenseNotFoundError to 404 EXPENSE_NOT_FOUND', () => {
    const { status, body } = toErrorResponse(new ExpenseNotFoundError('e1'))
    expect(status).toBe(404)
    expect(body.error.code).toBe('EXPENSE_NOT_FOUND')
  })

  it('maps DuplicateMemberError to 409 DUPLICATE_MEMBER', () => {
    const { status, body } = toErrorResponse(new DuplicateMemberError('g1', 'Alice'))
    expect(status).toBe(409)
    expect(body.error.code).toBe('DUPLICATE_MEMBER')
  })

  it('maps MemberReferencedError to 409 MEMBER_REFERENCED', () => {
    const { status, body } = toErrorResponse(new MemberReferencedError('m1'))
    expect(status).toBe(409)
    expect(body.error.code).toBe('MEMBER_REFERENCED')
  })

  it('maps GroupNotEmptyError to 409 GROUP_NOT_EMPTY', () => {
    const { status, body } = toErrorResponse(new GroupNotEmptyError('g1'))
    expect(status).toBe(409)
    expect(body.error.code).toBe('GROUP_NOT_EMPTY')
  })

  it('maps core ValidationError to 422 INVALID_SPLIT', () => {
    const { status, body } = toErrorResponse(
      new ValidationError('shares do not sum to amount'),
    )
    expect(status).toBe(422)
    expect(body.error.code).toBe('INVALID_SPLIT')
  })

  it('maps MemberNotInGroupError to 422 MEMBER_NOT_IN_GROUP', () => {
    const { status, body } = toErrorResponse(new MemberNotInGroupError('m1', 'g1'))
    expect(status).toBe(422)
    expect(body.error.code).toBe('MEMBER_NOT_IN_GROUP')
  })

  it('maps an unrecognized plain Error to 500 INTERNAL_ERROR without leaking its message', () => {
    const secret = '/home/afrina/split/dev.db'
    const { status, body } = toErrorResponse(
      new Error(`could not open database file at ${secret}`),
    )

    expect(status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(JSON.stringify(body)).not.toContain(secret)
  })

  it('maps a plain Error styled like settle.ts corrupted-data messages to 500, not 422', () => {
    const { status, body } = toErrorResponse(
      new Error('Balances must sum to zero, got 5'),
    )
    expect(status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('maps an arbitrary non-Error thrown value to 500 INTERNAL_ERROR', () => {
    const { status, body } = toErrorResponse('a string was thrown, not an Error')
    expect(status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
