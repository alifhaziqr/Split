import { Hono } from 'hono'

import type { PrismaClient } from '../../../generated/prisma/client.js'
import { createExpense, deleteExpense } from '../../db/expenses.js'
import { toExpenseDto } from '../dto.js'
import { CreateExpenseSchema } from '../schemas.js'
import { requireGroupExists, requireParam } from './shared.js'

export function createExpenseRoutes(db: PrismaClient): Hono {
  const app = new Hono()

  app.post('/api/groups/:groupId/expenses', async (c) => {
    const groupId = requireParam(c, 'groupId')

    // Cheap, in-memory body validation runs before the group-existence DB
    // round trip — a garbage body is rejected the same way whether or not
    // the groupId in the URL happens to be real.
    const body = await c.req.json<unknown>()
    const parsed = CreateExpenseSchema.safeParse(body)
    if (!parsed.success) {
      throw parsed.error
    }

    await requireGroupExists(db, groupId)
    const expense = await createExpense(db, { groupId, ...parsed.data })
    return c.json(toExpenseDto(expense), 201)
  })

  // Deliberately not nested under /api/groups/:groupId — an expense id alone
  // is enough to find and delete it, and nesting would force this one route
  // across two mount points for no benefit.
  app.delete('/api/expenses/:expenseId', async (c) => {
    const expenseId = requireParam(c, 'expenseId')
    await deleteExpense(db, expenseId)
    return c.body(null, 204)
  })

  return app
}
