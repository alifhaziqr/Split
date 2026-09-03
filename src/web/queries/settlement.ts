import { useQuery } from '@tanstack/react-query'

import { useApiClient } from '../net/apiClientContext.js'
import { groupKeys } from './queryKeys.js'

export function useSettlementQuery(groupId: string) {
  const client = useApiClient()
  return useQuery({
    queryKey: groupKeys.settlement(groupId),
    queryFn: () => client.getSettlement(groupId),
  })
}
