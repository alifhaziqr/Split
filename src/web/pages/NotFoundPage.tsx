import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="space-y-2 text-center">
      <h1>Page not found</h1>
      <Link to="/">Back to groups</Link>
    </div>
  )
}
