import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmButton } from '../../../src/web/components/ConfirmButton.js'

describe('ConfirmButton', () => {
  it('does not call onConfirm on the first click — asks for confirmation instead', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmButton onConfirm={onConfirm}>Remove</ConfirmButton>,
    )

    await user.click(screen.getByRole('button', { name: 'Remove' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /sure/i })).toBeInTheDocument()
  })

  it('calls onConfirm on the second click', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmButton onConfirm={onConfirm}>Remove</ConfirmButton>,
    )

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('button', { name: /sure/i }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('resets to the initial label after confirming, rather than staying armed', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmButton onConfirm={onConfirm}>Remove</ConfirmButton>,
    )

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('button', { name: /sure/i }))

    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('is disabled and does not arm when disabled is passed', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmButton onConfirm={onConfirm} disabled>
        Remove
      </ConfirmButton>,
    )

    const button = screen.getByRole('button', { name: 'Remove' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
