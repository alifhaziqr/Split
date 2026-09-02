/**
 * The client's hand-mirrored copy of the server's wire contract — see
 * src/server/api/dto.ts, src/server/api/schemas.ts, and
 * src/server/settlement.ts for the authoritative shapes. Mirrored rather
 * than imported: src/server/api/dto.ts imports Prisma's generated client,
 * which is gitignored and only exists after `postinstall`, so importing it
 * from src/web would couple the client's type graph to generated output it
 * has no business depending on.
 *
 * tests/web/net/types.test.ts proves these stay exactly in sync with the
 * server via compile-time Exact<> assertions, checked by `npm run
 * typecheck` — not by this file itself, which no other module should import
 * from except that test.
 */

export interface WireMember {
  readonly id: string
  readonly name: string
}

export interface WireExpenseShare {
  readonly memberId: string
  readonly shareCents: number
}

export interface WireExpense {
  readonly id: string
  readonly description: string
  readonly amountCents: number
  readonly paidByMemberId: string
  readonly date: string
  readonly splitMode: string
  readonly createdAt: string
  readonly shares: readonly WireExpenseShare[]
}

export interface WireGroup {
  readonly id: string
  readonly name: string
  readonly currency: string
  readonly createdAt: string
}

export interface WireGroupDetails extends WireGroup {
  readonly members: readonly WireMember[]
  readonly expenses: readonly WireExpense[]
}

export interface WireBalance {
  readonly memberId: string
  readonly balanceCents: number
}

export interface WireTransfer {
  readonly fromMemberId: string
  readonly toMemberId: string
  readonly amountCents: number
}

export interface WireSettlement {
  readonly balances: readonly WireBalance[]
  readonly transfers: readonly WireTransfer[]
}

/** Request bodies the client sends. */

export interface CreateGroupBody {
  readonly name: string
  readonly currency: string
}

export interface AddMemberBody {
  readonly name: string
}

// Mirrors z.input<typeof SplitInputSchema> — deliberately mutable arrays
// (string[], not readonly string[]), matching what zod's input type actually
// is, not core/split.ts's SplitInput (whose arrays are readonly). A mutable
// array is still assignable wherever core's SplitInput is expected.
export type WireSplitInput =
  | { readonly mode: 'EQUAL'; readonly memberIds: string[] }
  | { readonly mode: 'EXACT'; readonly shares: { memberId: string; shareCents: number }[] }
  | { readonly mode: 'PERCENT'; readonly shares: { memberId: string; percentBp: number }[] }
  | { readonly mode: 'SHARES'; readonly shares: { memberId: string; weight: number }[] }

// Mirrors z.input<typeof CreateExpenseSchema>: `date` is the string the
// caller sends, not the Date schemas.ts transforms it into.
export interface CreateExpenseBody {
  readonly description: string
  readonly amountCents: number
  readonly paidByMemberId: string
  readonly date: string
  readonly split: WireSplitInput
}
