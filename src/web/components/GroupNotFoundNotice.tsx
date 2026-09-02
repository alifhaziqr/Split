import { Link } from 'react-router'

import { errorMessageFor } from '../lib/errorMessages.js'

/**
 * Rendered by GroupGate for the 'gone' state, so a deleted-in-another-tab
 * or stale-bookmark GROUP_NOT_FOUND always gets the same dedicated state
 * with a way back, rather than a generic error banner. Sources its copy
 * from errorMessageFor so the sentence has one owner, not a second
 * hand-typed copy of errorMessages.ts's GROUP_NOT_FOUND case.
 */
export function GroupNotFoundNotice() {
  return (
    <div className="space-y-2 rounded-lg border border-subtle bg-surface p-4 text-center">
      <p className="text-muted">{errorMessageFor('GROUP_NOT_FOUND')}</p>
      <Link to="/">Back to groups</Link>
    </div>
  )
}
