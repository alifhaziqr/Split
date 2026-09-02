/**
 * Dev server and production build for the React client in src/web.
 *
 * Vitest does NOT read this file — when vitest.config.ts exists vitest loads
 * that instead, and its `web` project declares its own `plugins: [react()]`.
 * If a plugin or a resolve alias is added here, add it there too — with one
 * deliberate exception: `tailwindcss()` below is NOT mirrored into
 * vitest.config.ts. That plugin transforms CSS only; no test imports
 * index.css (main.tsx is its sole importer, and main.tsx is deliberately
 * untested — see its own docblock), and jsdom computes no styles regardless,
 * so mirroring it would add a CSS scan to every web test run for nothing.
 */

import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const repoRoot = new URL('.', import.meta.url)

export default defineConfig({
  // The client is self-contained under src/web, so index.html lives there
  // rather than at the repo root. Absolute paths throughout, so that nothing
  // below has to be read relative to this `root`.
  root: fileURLToPath(new URL('src/web', repoRoot)),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: fileURLToPath(new URL('dist/web', repoRoot)),
    // Required because outDir is outside `root`: Vite refuses to clear such a
    // directory unless told to explicitly.
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Every server route is already mounted under /api (see
      // src/server/api/routes/*), so one prefix covers the whole API surface.
      // Proxying rather than serving the built client from Hono means the
      // browser only ever makes same-origin requests in dev, so
      // src/server/app.ts still needs no CORS middleware — its only jobs stay
      // composition and error mapping — and the client can use relative URLs
      // like `/api/groups` unchanged in both dev and production.
      //
      // 3000 is src/server/index.ts's default. Vite does not load .env into
      // process.env, so setting PORT in .env moves the server but NOT this
      // target; export PORT in the shell (or edit here) if you override it.
      '/api': { target: 'http://localhost:3000' },
    },
  },
})
