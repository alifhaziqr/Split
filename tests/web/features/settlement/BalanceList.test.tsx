import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BalanceList } from '../../../../src/web/features/settlement/BalanceList.js'
import type { WireBalance, WireMember } from '../../../../src/web/net/types.js'

const MEMBERS: WireMember[] = [
  { id: 'm1', name: 'Ana' },
  { id: 'm2', name: 'Bob' },
  { id: 'm3', name: 'Cy' },
]

describe('BalanceList', () => {
  it('shows a positive balance as being owed money', () => {
    const balances: WireBalance[] = [{ memberId: 'm1', balanceCents: 1250 }]
    render(<BalanceList balances={balances} members={MEMBERS} currency="USD" />)

    expect(screen.getByRole('listitem')).toHaveTextContent('Ana is owed 12.50 USD')
  })

  it('shows a negative balance as owing money', () => {
    const balances: WireBalance[] = [{ memberId: 'm2', balanceCents: -1250 }]
    render(<BalanceList balances={balances} members={MEMBERS} currency="USD" />)

    expect(screen.getByRole('listitem')).toHaveTextContent('Bob owes 12.50 USD')
  })

  it('shows a zero balance as settled up', () => {
    const balances: WireBalance[] = [{ memberId: 'm3', balanceCents: 0 }]
    render(<BalanceList balances={balances} members={MEMBERS} currency="USD" />)

    expect(screen.getByRole('listitem')).toHaveTextContent('Cy is settled up')
  })
})
