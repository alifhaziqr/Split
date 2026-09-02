import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// `.env` is gitignored, so a fresh clone has no DATABASE_URL until someone
// copies .env.example — but `postinstall` runs `prisma generate` before a
// human gets the chance. env('DATABASE_URL') throws when unset, which broke
// `npm install` on a true clean checkout; this fallback is what makes it
// work. dotenv never overwrites an already-set variable, so an explicit
// DATABASE_URL (tests/server/db/testDb.ts passes its own per-run URL) still
// wins over both this fallback and any value from .env.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
})
