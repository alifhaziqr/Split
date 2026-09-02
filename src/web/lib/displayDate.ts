/**
 * Renders an ISO date string's calendar day for display: "2026-09-02T00:00:
 * 00.000Z" -> "2026-09-02". Slices the string rather than routing through
 * `new Date(...).toLocaleDateString()` — the server stores UTC midnight, and
 * `toLocaleDateString` in any negative-offset timezone renders the *previous*
 * calendar day. Slicing never touches the viewer's local timezone at all.
 */
export function displayDate(isoDate: string): string {
  return isoDate.slice(0, 10)
}
