import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmptyState } from '../../../src/web/components/EmptyState.js'

describe('EmptyState', () => {
  it('renders the given message', () => {
    render(<EmptyState message="No groups yet" />)

    expect(screen.getByText('No groups yet')).toBeInTheDocument()
  })
})
