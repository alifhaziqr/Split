import { Link } from 'react-router'

/**
 * Shared by every page that fetches a group by id (GroupDetailPage,
 * AddExpensePage, ...) so a deleted-in-another-tab or stale-bookmark
 * GROUP_NOT_FOUND always gets the same dedicated "gone" state with a way
 * back, rather than a generic error banner on some pages and not others.
 */
export function GroupNotFoundNotice() {
  return (
    <div>
      <p>This group no longer exists.</p>
      <Link to="/">Back to groups</Link>
    </div>
  )
}
