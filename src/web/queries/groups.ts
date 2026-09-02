import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApiClient } from '../net/apiClientContext.js'
import type { CreateGroupBody } from '../net/types.js'
import { groupKeys } from './queryKeys.js'

export function useGroupsQuery() {
  const client = useApiClient()
  return useQuery({ queryKey: groupKeys.list(), queryFn: () => client.listGroups() })
}

export function useGroupQuery(groupId: string) {
  const client = useApiClient()
  return useQuery({ queryKey: groupKeys.detail(groupId), queryFn: () => client.getGroup(groupId) })
}

export function useCreateGroup() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateGroupBody) => client.createGroup(body),
    onSuccess: () => {
      // POST /api/groups returns a GroupDto (no members/expenses) — never
      // seed groupKeys.detail(id) from it, that key's cached shape is
      // GroupDetailsDto and a members-less object there would be a lie.
      queryClient.invalidateQueries({ queryKey: groupKeys.list() })
    },
  })
}

export function useDeleteGroup() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (groupId: string) => client.deleteGroup(groupId),
    onSuccess: (_data, groupId) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.list() })
      // Removed, not invalidated: invalidating a deleted group's detail
      // entry would refetch it straight into a 404 and flash an error on
      // the way out of the page.
      queryClient.removeQueries({ queryKey: groupKeys.detail(groupId) })
    },
  })
}
