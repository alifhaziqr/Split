/**
 * zod request-validation schemas for the REST API.
 *
 * These schemas validate STRUCTURE ONLY — types, presence, numeric ranges,
 * and (via strictObject) rejection of unrecognized keys. They deliberately do
 * NOT re-derive the cross-field arithmetic that `core/split.ts` already owns:
 * whether PERCENT shares sum to 10000 basis points, whether EXACT shares sum
 * to the expense amount, or anything about SHARES weights. `splitAmount`
 * re-validates and throws `ValidationError` for all of that — see CLAUDE.md's
 * M2 note ("core functions validate their own inputs"). Duplicating any of
 * it here would create two sources of truth for the same rule.
 */

import { z } from 'zod'

/** A member id as it crosses the HTTP boundary: any non-empty string. */
const MemberId = z.string().min(1)

/**
 * Prisma's `Int` column is 32-bit signed, so amountCents cannot round-trip
 * through storage past this even though SQLite itself is wider.
 */
const AmountCents = z.int().min(0).max(2147483647)

/**
 * Shared bound for shareCents / percentBp / weight. Chosen so that
 * amountCents (bounded above) times this bound stays enormously far below
 * Number.MAX_SAFE_INTEGER, protecting the allocation arithmetic downstream.
 */
const ShareBound = z.int().min(0).max(1_000_000)

export const SplitInputSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('EQUAL'),
    memberIds: z.array(MemberId).min(1).max(100),
  }),
  z.strictObject({
    mode: z.literal('EXACT'),
    shares: z
      .array(z.strictObject({ memberId: MemberId, shareCents: ShareBound }))
      .min(1)
      .max(100),
  }),
  z.strictObject({
    mode: z.literal('PERCENT'),
    shares: z
      .array(z.strictObject({ memberId: MemberId, percentBp: ShareBound }))
      .min(1)
      .max(100),
  }),
  z.strictObject({
    mode: z.literal('SHARES'),
    shares: z
      .array(z.strictObject({ memberId: MemberId, weight: ShareBound }))
      .min(1)
      .max(100),
  }),
])

export const CreateGroupSchema = z.strictObject({
  name: z.string().min(1),
  currency: z.string().min(1),
})

export const AddMemberSchema = z.strictObject({
  name: z.string().min(1),
})

export const CreateExpenseSchema = z.strictObject({
  description: z.string().min(1),
  amountCents: AmountCents,
  paidByMemberId: MemberId,
  date: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'date must be a valid ISO-8601-ish date string',
    })
    .transform((value) => new Date(value)),
  split: SplitInputSchema,
})

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>
