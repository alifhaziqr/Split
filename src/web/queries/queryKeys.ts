/**
 * The single source of truth for query cache identity and invalidation
 * scope. Load-bearing decision: settlement(id) is nested UNDER detail(id),
 * so a prefix-matched invalidateQueries({queryKey: detail(id)}) refetches
 * both the group's detail and its settlement in one call. That's correct
 * because no mutation in this app changes a group's members or expenses
 * without also changing its settlement — including addMember, since
 * server/settlement.ts seeds a zero balance for every member, so a new
 * member appears in `balances` immediately. See tests/web/queries/
 * queryKeys.test.ts for the assertion that this nesting holds.
 */

export const groupKeys = {
  all: ['groups'] as const,
  list: () => [...groupKeys.all, 'list'] as const,
  detail: (groupId: string) => [...groupKeys.all, 'detail', groupId] as const,
  settlement: (groupId: string) => [...groupKeys.detail(groupId), 'settlement'] as const,
}
