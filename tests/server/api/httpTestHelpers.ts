/**
 * Low-level HTTP request/response helpers shared by every test file under
 * tests/server/api/ that drives a Hono app via `app.request()`. Kept to just
 * the primitives that never need to change per file — routes.test.ts and
 * endToEnd.test.ts each build their own higher-level, file-specific fixture
 * helpers (createGroupOk, addMemberOk, and so on) on top of these.
 */

import type { Hono } from 'hono'

export const JSON_HEADERS = { 'content-type': 'application/json' }

/** `await response.json()` is typed `unknown` in this project — narrow at each call site. */
export async function readJson(response: Response): Promise<unknown> {
  return await response.json()
}

export interface ErrorBody {
  readonly error: { readonly code: string; readonly message: string }
}

export async function readError(response: Response): Promise<ErrorBody> {
  // Safe: errors.ts's toErrorResponse always produces this shape, and this
  // helper is only ever called against a response already asserted non-2xx.
  return (await readJson(response)) as ErrorBody
}

/**
 * `getApp` is a thunk rather than a plain `Hono` value because every caller
 * builds its app inside a `beforeAll` hook, after this factory is invoked at
 * module scope — the thunk defers the read until a test actually runs one of
 * the returned methods, by which point `beforeAll` has already set it.
 */
export function createHttpClient(getApp: () => Hono) {
  return {
    async postJson(path: string, body: unknown): Promise<Response> {
      return await getApp().request(path, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      })
    },
    async del(path: string): Promise<Response> {
      return await getApp().request(path, { method: 'DELETE' })
    },
  }
}
