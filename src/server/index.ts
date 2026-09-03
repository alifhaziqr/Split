/**
 * Process entrypoint / composition root. This is the ONLY file under
 * src/server/ allowed to import '@hono/node-server' — app.ts must never
 * import it, so that any test importing app.ts can never accidentally bind
 * a real network port. Run with `npm run dev` (tsx watch) or `tsx
 * src/server/index.ts`.
 */

import 'dotenv/config'

import { serve } from '@hono/node-server'

import { createApp } from './app.js'
import { createDbClient } from './db/client.js'

const databaseUrl = process.env.DATABASE_URL
if (databaseUrl === undefined || databaseUrl === '') {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env (cp .env.example .env) before starting the server.',
  )
}

const parsedPort = Number(process.env.PORT)
const port =
  process.env.PORT !== undefined && process.env.PORT !== '' && Number.isFinite(parsedPort)
    ? parsedPort
    : 3000

const db = createDbClient(databaseUrl)
const app = createApp(db)

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Split server listening on http://localhost:${info.port}`)
})
