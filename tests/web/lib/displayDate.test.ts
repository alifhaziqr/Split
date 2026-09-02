import { describe, expect, it } from 'vitest'

import { displayDate } from '../../../src/web/lib/displayDate.js'

describe('displayDate', () => {
  it('renders the calendar date from a UTC-midnight ISO string', () => {
    expect(displayDate('2026-09-02T00:00:00.000Z')).toBe('2026-09-02')
  })

  it('slices rather than reformatting through Date, so a negative-offset timezone cannot shift the day', () => {
    // new Date('2026-01-01T00:00:00.000Z').toLocaleDateString() renders
    // '12/31/2025' in any negative-offset timezone — exactly the bug this
    // function exists to avoid. Slicing the ISO string never touches the
    // viewer's local timezone at all.
    expect(displayDate('2026-01-01T00:00:00.000Z')).toBe('2026-01-01')
  })

  it('works for a date-only string with no time component', () => {
    expect(displayDate('2026-09-02')).toBe('2026-09-02')
  })
})
