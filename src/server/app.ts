/**
 * Composes the REST API's route modules onto one Hono app and wires up
 * error handling. This file's ONLY jobs are composition and error mapping —
 * it never imports '@hono/node-server' or calls anything like serve(), so
 * that importing it (as tests do, via app.request()) can never accidentally
 * bind a real network port. A separate, later entrypoint file owns that.
 */

import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import type { PrismaClient } from '../generated/prisma/client.js'
import { toErrorResponse } from './api/errors.js'
import { createExpenseRoutes } from './api/routes/expenses.js'
import { createGroupRoutes } from './api/routes/groups.js'
import { createMemberRoutes } from './api/routes/members.js'
import { createSettlementRoutes } from './api/routes/settlement.js'

export function createApp(db: PrismaClient): Hono {
  const app = new Hono()

  app.route('/', createGroupRoutes(db))
  app.route('/', createMemberRoutes(db))
  app.route('/', createExpenseRoutes(db))
  app.route('/', createSettlementRoutes(db))

  app.onError((err, c) => {
    const { status, body } = toErrorResponse(err)
    // toErrorResponse only ever returns one of its own fixed, contentful
    // status codes (400/404/409/422/500) — narrowing the type here is sound.
    return c.json(body, status as ContentfulStatusCode)
  })

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404))

  return app
}
