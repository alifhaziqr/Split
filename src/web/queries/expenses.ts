import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useApiClient } from '../net/apiClientContext.js'
import type { CreateExpenseBody } from '../net/types.js'
import { groupKeys } from './queryKeys.js'

export function useCreateExpense(groupId: string) {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateExpenseBody) => client.createExpense(groupId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) })
    },
  })
}

export interface DeleteExpenseVariables {
  readonly expenseId: string
  // DELETE /api/expenses/:expenseId carries no groupId of its own — this
  // field exists purely to know which group's cache to invalidate, and is
  // never sent to the server. Easy to drop by accident; see
  // tests/web/queries/expenses.test.ts for the test that fails if it is.
  readonly groupId: string
}

export function useDeleteExpense() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (variables: DeleteExpenseVariables) => client.deleteExpense(variables.expenseId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(variables.groupId) })
    },
  })
}
