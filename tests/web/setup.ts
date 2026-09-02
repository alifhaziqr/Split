/**
 * Runs before every file in the `web` vitest project (see vitest.config.ts's
 * setupFiles). Two jobs, both needed once per test file:
 *
 *  - register @testing-library/jest-dom's matchers on vitest's `expect`. The
 *    import is also what gives the whole program their *types*: the
 *    package's /vitest entrypoint is a `declare module 'vitest'`
 *    augmentation, so importing it from a file inside tsconfig's `include`
 *    is enough — no entry needs to be added to tsconfig's explicit `types`
 *    allowlist.
 *  - unmount whatever React Testing Library rendered, so a component from
 *    one test is not still in the jsdom document during the next one.
 *
 * Not named *.test.ts, so vitest never collects it as a suite of its own —
 * same convention as tests/server/db/testDb.ts and
 * tests/server/api/httpTestHelpers.ts.
 */

import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
