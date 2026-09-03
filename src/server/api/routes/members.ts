import { Hono } from 'hono'

import type { PrismaClient } from '../../../generated/prisma/client.js'
import { addMember, deleteMember, MemberNotFoundError } from '../../db/members.js'
import { toMemberDto } from '../dto.js'
import { AddMemberSchema } from '../schemas.js'
import { requireGroupExists, requireParam } from './shared.js'

export function createMemberRoutes(db: PrismaClient): Hono {
  const app = new Hono()

  app.post('/api/groups/:groupId/members', async (c) => {
    const groupId = requireParam(c, 'groupId')

    // Cheap, in-memory body validation runs before the group-existence DB
    // round trip — a garbage body is rejected the same way whether or not
    // the groupId in the URL happens to be real.
    const body = await c.req.json<unknown>()
    const parsed = AddMemberSchema.safeParse(body)
    if (!parsed.success) {
      throw parsed.error
    }

    await requireGroupExists(db, groupId)
    const member = await addMember(db, groupId, parsed.data.name)
    return c.json(toMemberDto(member), 201)
  })

  app.delete('/api/groups/:groupId/members/:memberId', async (c) => {
    const groupId = requireParam(c, 'groupId')
    const memberId = requireParam(c, 'memberId')
    await requireGroupExists(db, groupId)

    // deleteMember only knows a memberId, not which group's URL it was
    // reached through, so a member of a DIFFERENT group would otherwise be
    // deletable via this group's URL. Scope the lookup to both ids first.
    //
    // This read-then-delete is race-free: nothing anywhere in this API ever
    // changes a Member's groupId, so a member found scoped to (memberId,
    // groupId) here cannot have moved to a different group by the time the
    // delete below runs.
    const member = await db.member.findFirst({
      where: { id: memberId, groupId },
      select: { id: true },
    })
    if (member === null) {
      throw new MemberNotFoundError(memberId)
    }

    await deleteMember(db, memberId)
    return c.body(null, 204)
  })

  return app
}
