/**
 * The nine REST endpoints, one small method each, composed over
 * createRequest. One file rather than four mirroring
 * src/server/api/routes/* — the server splits by file because each route
 * module holds real handler logic (validation ordering, existence
 * pre-checks); every method here is a one- or two-line `request(...)` call.
 *
 * `fetch` is accepted as an option (defaulting to globalThis.fetch) rather
 * than read directly, so a test can inject vi.fn<FetchLike>() and the
 * contract test can inject the real Hono app's app.request — see http.ts.
 */

import type { FetchLike } from './http.js'
import { createRequest } from './http.js'
import type {
  AddMemberBody,
  CreateExpenseBody,
  CreateGroupBody,
  WireExpense,
  WireGroup,
  WireGroupDetails,
  WireMember,
  WireSettlement,
} from './types.js'

export interface ApiClientOptions {
  readonly fetch?: FetchLike | undefined
  readonly baseUrl?: string | undefined
}

export function createApiClient(options: ApiClientOptions = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const base = options.baseUrl ?? ''
  const request = createRequest(fetchImpl)

  return {
    createGroup: (body: CreateGroupBody) =>
      request<WireGroup>('POST', `${base}/api/groups`, body),
    listGroups: () =>
      request<{ groups: readonly WireGroup[] }>('GET', `${base}/api/groups`),
    getGroup: (groupId: string) =>
      request<WireGroupDetails>('GET', `${base}/api/groups/${groupId}`),
    deleteGroup: (groupId: string) =>
      request<undefined>('DELETE', `${base}/api/groups/${groupId}`),

    addMember: (groupId: string, body: AddMemberBody) =>
      request<WireMember>('POST', `${base}/api/groups/${groupId}/members`, body),
    deleteMember: (groupId: string, memberId: string) =>
      request<undefined>('DELETE', `${base}/api/groups/${groupId}/members/${memberId}`),

    createExpense: (groupId: string, body: CreateExpenseBody) =>
      request<WireExpense>('POST', `${base}/api/groups/${groupId}/expenses`, body),
    // Deliberately not group-scoped in its URL, matching the server: an
    // expense id alone is enough to find and delete it.
    deleteExpense: (expenseId: string) =>
      request<undefined>('DELETE', `${base}/api/expenses/${expenseId}`),

    getSettlement: (groupId: string) =>
      request<WireSettlement>('GET', `${base}/api/groups/${groupId}/settlement`),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
