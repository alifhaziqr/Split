import { describe, expect, it } from 'vitest'

import { groupKeys } from '../../../src/web/queries/queryKeys.js'

describe('groupKeys', () => {
  it('gives distinct keys for list, detail, and settlement', () => {
    const keys = [groupKeys.list(), groupKeys.detail('g1'), groupKeys.settlement('g1')]
    const serialized = keys.map((k) => JSON.stringify(k))

    expect(new Set(serialized).size).toBe(serialized.length)
  })

  it('is stable — the same arguments produce an equal key every call', () => {
    expect(groupKeys.detail('g1')).toEqual(groupKeys.detail('g1'))
    expect(groupKeys.settlement('g1')).toEqual(groupKeys.settlement('g1'))
  })

  it('gives different groups different detail keys', () => {
    expect(groupKeys.detail('g1')).not.toEqual(groupKeys.detail('g2'))
  })

  it("nests settlement(id) under detail(id), so invalidating detail(id) also matches settlement(id)", () => {
    // TanStack Query invalidation is prefix-matched: invalidating
    // detail(id) must refetch settlement(id) too, in one call, because no
    // mutation in this app changes a group's members/expenses without also
    // changing its settlement (see server/settlement.ts seeding a zero
    // balance for every member). This is the property the whole
    // invalidation design depends on — see CLAUDE.md / the M5 design.
    const groupId = 'g1'
    const detail = groupKeys.detail(groupId)
    const settlement = groupKeys.settlement(groupId)

    expect(settlement.length).toBeGreaterThan(detail.length)
    expect(settlement.slice(0, detail.length)).toEqual(detail)
  })
})
