import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Money } from '../../../src/web/components/Money.js'

describe('Money', () => {
  it('renders cents as a two-decimal amount with the currency code', () => {
    render(<Money cents={8450} currency="USD" />)

    expect(screen.getByText('84.50 USD')).toBeInTheDocument()
  })

  it('renders a negative amount with its sign', () => {
    render(<Money cents={-500} currency="EUR" />)

    expect(screen.getByText('-5.00 EUR')).toBeInTheDocument()
  })

  it('renders zero without a stray sign', () => {
    render(<Money cents={0} currency="USD" />)

    expect(screen.getByText('0.00 USD')).toBeInTheDocument()
  })
})
