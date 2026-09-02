/** Inline loading indicator. role="status" + the label is the whole accessibility story. */

export function Spinner(props: { readonly label?: string | undefined }) {
  return <span role="status">{props.label ?? 'Loading…'}</span>
}
