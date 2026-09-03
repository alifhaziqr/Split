import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TransferList } from '../../../../src/web/features/settlement/TransferList.js'
import type { WireMember, WireTransfer } from '../../../../src/web/net/types.js'

const MEMBERS: WireMember[] = [
  { id: 'm1', name: 'Ana' },
  { id: 'm2', name: 'Bob' },
]

describe('TransferList', () => {
  it('renders each transfer as "X pays Y amount"', () => {
    const transfers: WireTransfer[] = [
      { fromMemberId: 'm2', toMemberId: 'm1', amountCents: 1250 },
    ]
    render(<TransferList transfers={transfers} members={MEMBERS} currency="USD" />)

    expect(screen.getByRole('listitem')).toHaveTextContent('Bob pays Ana 12.50 USD')
  })

  it('shows "Everyone is settled up" when there are no transfers', () => {
    render(<TransferList transfers={[]} members={MEMBERS} currency="USD" />)

    expect(screen.getByText(/Everyone is settled up/i)).toBeInTheDocument()
  })
})
