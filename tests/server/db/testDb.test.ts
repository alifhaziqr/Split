import { readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, execFileSync: vi.fn() }
})

import { execFileSync } from 'node:child_process'
import { createTestDatabase } from './testDb.js'

const mockedExecFileSync = vi.mocked(execFileSync)

function splitTestDirs(): string[] {
  return readdirSync(tmpdir()).filter((name) => name.startsWith('split-test-'))
}

afterEach(() => {
  mockedExecFileSync.mockReset()
})

describe('createTestDatabase', () => {
  it('propagates the real migration error rather than a follow-on crash', () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error('migration failed: syntax error in migration.sql')
    })

    expect(() => createTestDatabase()).toThrow(
      'migration failed: syntax error in migration.sql',
    )
  })

  it('removes the temp directory it created when migration fails', () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error('boom')
    })

    const before = splitTestDirs()
    expect(() => createTestDatabase()).toThrow()
    const after = splitTestDirs()

    expect(after).toEqual(before)
  })
})
