import { Hono } from 'hono'

import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  createGroup,
  deleteGroup,
  GroupNotFoundError,
  getGroupWithDetails,
  listGroups,
} from '../../db/groups.js'
import { toGroupDetailsDto, toGroupDto } from '../dto.js'
import { CreateGroupSchema } from '../schemas.js'
import { requireParam } from './shared.js'

/**
 * Group-scoped routes registered at their full absolute paths. `db` is
 * captured by closure rather than threaded through Hono's Variables generic
 * — there is exactly one dependency, fully known when the app is built.
 */
export function createGroupRoutes(db: PrismaClient): Hono {
  const app = new Hono()

  app.post('/api/groups', async (c) => {
    const body = await c.req.json<unknown>()
    const parsed = CreateGroupSchema.safeParse(body)
    if (!parsed.success) {
      throw parsed.error
    }

    const group = await createGroup(db, parsed.data)
    return c.json(toGroupDto(group), 201)
  })

  app.get('/api/groups', async (c) => {
    const groups = await listGroups(db)
    // listGroups already returns a deterministic order — do not re-sort here.
    return c.json({ groups: groups.map(toGroupDto) }, 200)
  })

  app.get('/api/groups/:groupId', async (c) => {
    const groupId = requireParam(c, 'groupId')

    const details = await getGroupWithDetails(db, groupId)
    if (details === null) {
      throw new GroupNotFoundError(groupId)
    }
    return c.json(toGroupDetailsDto(details), 200)
  })

  app.delete('/api/groups/:groupId', async (c) => {
    const groupId = requireParam(c, 'groupId')

    // No requireGroupExists pre-check here: unlike the other groupId-scoped
    // routes, deleteGroup itself already turns a missing group (Prisma P2025)
    // into GroupNotFoundError, so a pre-check would only add a redundant
    // SELECT ahead of the DELETE with no behavioral difference.
    await deleteGroup(db, groupId)
    return c.body(null, 204)
  })

  return app
}
