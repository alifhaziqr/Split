import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useApiClient } from '../net/apiClientContext.js'
import type { AddMemberBody } from '../net/types.js'
import { groupKeys } from './queryKeys.js'

export function useAddMember(groupId: string) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: AddMemberBody) => client.addMember(groupId, body),
    // Invalidating detail(groupId) prefix-covers settlement(groupId) too —
    // a new member appears in the settlement's balances immediately (see
    // server/settlement.ts seeding a zero balance for every member).
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
    },
  })
}

export function useDeleteMember(groupId: string) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => client.deleteMember(groupId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
    },
  })
}
