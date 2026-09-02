/** "No groups yet" / "No expenses yet" shell — one message, nothing fancier. */

export function EmptyState(props: { readonly message: string }) {
  return <p>{props.message}</p>
}
