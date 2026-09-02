import type { ReactNode } from 'react'
import { Link } from 'react-router'

/**
 * Sticky header + centred main content area, wrapped around the route table
 * in App.tsx. The brand is a `<Link>`, not an `<h1>` — an `<h1>` here would
 * collide semantically with GroupsPage's own `<h1>Groups</h1>` and
 * GroupHeader's `<h1>{name}</h1>`, and would put a second heading in reach
 * of App.test.tsx's `getByRole('heading', { name: 'Groups' })`.
 */
export function AppShell(props: { readonly children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-subtle bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold text-fg no-underline hover:no-underline">
            Split
          </Link>
          <Link to="/" className="text-sm font-medium text-muted hover:text-fg">
            Groups
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{props.children}</main>
    </div>
  )
}
