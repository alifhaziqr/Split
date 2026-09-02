import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'

import { GroupList } from '../../../../src/web/features/groups/GroupList.js'
import type { WireGroup } from '../../../../src/web/net/types.js'

const GROUPS: WireGroup[] = [
  { id: 'g1', name: 'Trip', currency: 'USD', createdAt: '2026-09-01T00:00:00.000Z' },
  { id: 'g2', name: 'Roommates', currency: 'EUR', createdAt: '2026-09-02T00:00:00.000Z' },
]

describe('GroupList', () => {
  it('renders a link to each group\'s detail page', () => {
    render(
      <MemoryRouter>
        <GroupList groups={GROUPS} />
      </MemoryRouter>,
    )

    const tripLink = screen.getByRole('link', { name: /Trip/ })
    expect(tripLink).toHaveAttribute('href', '/groups/g1')
    const roommatesLink = screen.getByRole('link', { name: /Roommates/ })
    expect(roommatesLink).toHaveAttribute('href', '/groups/g2')
  })

  it('renders an empty state when there are no groups', () => {
    render(
      <MemoryRouter>
        <GroupList groups={[]} />
      </MemoryRouter>,
    )

    expect(screen.getByText(/no groups yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
