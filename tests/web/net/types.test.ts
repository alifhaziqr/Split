import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { GroupDetailsDto, GroupDto } from '../../../src/server/api/dto.js'
import { CreateExpenseSchema } from '../../../src/server/api/schemas.js'
import type { Settlement } from '../../../src/server/settlement.js'
import type { CreateExpenseBody, WireGroup, WireGroupDetails, WireSettlement } from '../../../src/web/net/types.js'

/**
 * Compile-time proof that src/web/net/types.ts's hand-mirrored wire types
 * stay exactly in sync with the server's real DTOs and request schema.
 * `npm run typecheck` is what enforces this — vitest strips types at
 * runtime (that's why every assertion below evaluates to the literal `true`
 * regardless of whether the types actually match), so a mismatch here shows
 * up as a `tsc` failure, not a test failure.
 *
 * Verified by mutation (CLAUDE.md's M3 note: a check that can't fail is
 * worthless): temporarily rename a field on either side and confirm
 * `npm run typecheck` fails.
 */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

const groupMatches: Exact<GroupDto, WireGroup> = true
const detailsMatch: Exact<GroupDetailsDto, WireGroupDetails> = true
const settlementMatches: Exact<Settlement, WireSettlement> = true
const createExpenseMatches: Exact<z.input<typeof CreateExpenseSchema>, CreateExpenseBody> = true

describe('wire type contract', () => {
  it('keeps src/web/net/types.ts in sync with the server (enforced by npm run typecheck)', () => {
    expect([groupMatches, detailsMatch, settlementMatches, createExpenseMatches].every(Boolean)).toBe(true)
  })
})
