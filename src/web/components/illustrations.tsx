/**
 * Hand-authored inline SVG accents for empty/zero-data states — see
 * docs/adr/0001-ui-restyle-scope.md: no illustration-library dependency,
 * themeable via the existing --color-* custom properties so they follow
 * light/dark automatically.
 */

export function EmptyGroupsIllustration(props: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={props.className} aria-hidden="true" fill="none">
      <rect
        x="14"
        y="46"
        width="60"
        height="30"
        rx="8"
        stroke="var(--color-accent)"
        strokeOpacity="0.35"
        strokeWidth="2"
      />
      <rect
        x="28"
        y="30"
        width="60"
        height="30"
        rx="8"
        stroke="var(--color-accent)"
        strokeOpacity="0.6"
        strokeWidth="2"
      />
      <rect
        x="42"
        y="14"
        width="60"
        height="30"
        rx="8"
        fill="var(--color-accent)"
        fillOpacity="0.12"
        stroke="var(--color-accent)"
        strokeWidth="2"
      />
      <circle cx="102" cy="74" r="12" fill="var(--color-accent)" />
      <path
        d="M102 68v12M96 74h12"
        stroke="var(--color-accent-fg)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AllSettledIllustration(props: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={props.className} aria-hidden="true" fill="none">
      <circle
        cx="60"
        cy="45"
        r="28"
        fill="var(--color-positive)"
        fillOpacity="0.12"
        stroke="var(--color-positive)"
        strokeWidth="2"
      />
      <path
        d="M48 46l8 8 16-18"
        stroke="var(--color-positive)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="3" fill="var(--color-accent)" fillOpacity="0.5" />
      <circle cx="100" cy="18" r="2.5" fill="var(--color-positive)" fillOpacity="0.6" />
      <circle cx="104" cy="66" r="3" fill="var(--color-accent)" fillOpacity="0.4" />
    </svg>
  )
}
