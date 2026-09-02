import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Spinner } from '../../../src/web/components/Spinner.js'

describe('Spinner', () => {
  it('has an accessible status role with a default label', () => {
    render(<Spinner />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })

  it('accepts a custom label', () => {
    render(<Spinner label="Adding member…" />)

    expect(screen.getByRole('status')).toHaveTextContent('Adding member…')
  })
})
