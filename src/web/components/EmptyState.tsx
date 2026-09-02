/** "No groups yet" / "No expenses yet" shell — one message, nothing fancier. */

export function EmptyState(props: { readonly message: string }) {
  return <p className="text-sm text-muted">{props.message}</p>
}
