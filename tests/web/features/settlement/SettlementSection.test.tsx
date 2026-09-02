import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SettlementSection } from '../../../../src/web/features/settlement/SettlementSection.js'
import type { WireMember } from '../../../../src/web/net/types.js'
import { createFetchStub } from '../../fetchStub.js'
import { createProvidersWrapper } from '../../renderWithProviders.js'

const MEMBERS: WireMember[] = [
  { id: 'm1', name: 'Ana' },
  { id: 'm2', name: 'Bob' },
]

describe('SettlementSection', () => {
  it('fetches and renders balances and transfers for the group', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups/g1/settlement', {
      status: 200,
      body: {
        balances: [
          { memberId: 'm1', balanceCents: 1250 },
          { memberId: 'm2', balanceCents: -1250 },
        ],
        transfers: [{ fromMemberId: 'm2', toMemberId: 'm1', amountCents: 1250 }],
      },
    })
    const { Wrapper } = createProvidersWrapper({ fetch: stub.fetch })
    render(<SettlementSection groupId="g1" members={MEMBERS} currency="USD" />, { wrapper: Wrapper })

    await waitFor(() => expect(screen.getByText(/Ana is owed/)).toBeInTheDocument())
    expect(screen.getByText(/Bob pays Ana/)).toBeInTheDocument()
  })

  it('shows a loading indicator before the settlement arrives', () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups/g1/settlement', { status: 200, body: { balances: [], transfers: [] } })
    const { Wrapper } = createProvidersWrapper({ fetch: stub.fetch })
    render(<SettlementSection groupId="g1" members={MEMBERS} currency="USD" />, { wrapper: Wrapper })

    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
