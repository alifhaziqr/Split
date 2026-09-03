/**
 * Renders any caught error as user-facing copy. `role="alert"` is both the
 * accessibility requirement and the RTL `getByRole('alert')` query — same
 * requirement, one attribute. Never renders a thrown value's own .message:
 * a non-ApiError is unexpected by definition, so it gets the same generic
 * copy errorMessages.ts uses for INTERNAL_ERROR, never an arbitrary string
 * that might contain a stack trace or the user's own input echoed back.
 */

import { errorMessageFor } from '../lib/errorMessages.js'
import { isApiError } from '../net/apiError.js'

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

export function ErrorBanner(props: { readonly error: unknown }) {
  if (props.error === null || props.error === undefined) {
    return null
  }

  const message = isApiError(props.error)
    ? errorMessageFor(props.error.code)
    : GENERIC_MESSAGE

  return <div role="alert">{message}</div>
}
