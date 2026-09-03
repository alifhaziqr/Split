/**
 * Small helpers shared by every route module in this directory. Kept here
 * rather than duplicated per file because the group-existence pre-check in
 * particular is a correctness requirement that must be applied identically
 * everywhere a route has a `:groupId` path parameter — see CLAUDE.md's M4
 * design-review notes on why the underlying db/* functions can't be trusted
 * to surface a clean "group not found" on their own in every case.
 */

import type { Context } from 'hono'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { GroupNotFoundError } from '../../db/groups.js'

/**
 * Confirms a group exists before any other db/* call runs. Several of those
 * functions have no idea whether a groupId is real or bogus — for example,
 * createExpense's member-lookup query trivially returns no rows for a
 * nonexistent groupId too, so without this check callers would see a
 * confusing "member not in group" error instead of a clean "group not
 * found" for a simple typo'd id.
 */
export async function requireGroupExists(
  db: PrismaClient,
  groupId: string,
): Promise<void> {
  const group = await db.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  })
  if (group === null) {
    throw new GroupNotFoundError(groupId)
  }
}

/**
 * Reads a route path parameter that the route pattern guarantees is present
 * on any request that reached this handler. Hono types `param()` as
 * `string | undefined` because its signature has no way to encode "this key
 * is part of the matched pattern" — the thrown error below is unreachable in
 * practice and exists only to satisfy the type checker.
 */
export function requireParam(c: Context, name: string): string {
  const value = c.req.param(name)
  if (value === undefined) {
    throw new Error(`Missing required route parameter: ${name}`)
  }
  return value
}
