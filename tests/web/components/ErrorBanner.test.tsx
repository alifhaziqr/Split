import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../../src/web/net/apiError.js'
import { ErrorBanner } from '../../../src/web/components/ErrorBanner.js'

describe('ErrorBanner', () => {
  it('renders the mapped copy for a known ApiError code, in a role="alert" region', () => {
    render(<ErrorBanner error={new ApiError(409, 'DUPLICATE_MEMBER', 'wire message ignored')} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Someone in this group already has that name.')
  })

  it('renders generic copy for a non-ApiError throwable without crashing', () => {
    render(<ErrorBanner error={new Error('some other failure')} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('renders generic copy for a thrown non-Error value without crashing', () => {
    render(<ErrorBanner error={'a string was thrown'} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('renders nothing when there is no error', () => {
    const { container } = render(<ErrorBanner error={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
