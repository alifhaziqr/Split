import { Hono } from 'hono'

import type { PrismaClient } from '../../../generated/prisma/client.js'
import { getGroupWithDetails, GroupNotFoundError } from '../../db/groups.js'
import { settleGroup } from '../../settlement.js'
import { requireParam } from './shared.js'

export function createSettlementRoutes(db: PrismaClient): Hono {
  const app = new Hono()

  app.get('/api/groups/:groupId/settlement', async (c) => {
    const groupId = requireParam(c, 'groupId')

    const details = await getGroupWithDetails(db, groupId)
    if (details === null) {
      throw new GroupNotFoundError(groupId)
    }

    // settleGroup's result is already wire-ready — plain numbers and
    // strings, no Date fields — so it needs no DTO mapping of its own.
    return c.json(settleGroup(details), 200)
  })

  return app
}
