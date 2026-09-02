import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..')
const CORE_DIR = join(REPO_ROOT, 'src', 'core')
const SERVER_DIR = join(REPO_ROOT, 'src', 'server')

/** Matches an `import ... from '...'` or `export ... from '...'` clause, single or double quotes. */
const IMPORT_SPECIFIER_RE = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g

function extractImportSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER_RE)].map((match) => match[1] as string)
}

function listTsFilesRecursive(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) return listTsFilesRecursive(fullPath)
    return entry.isFile() && entry.name.endsWith('.ts') ? [fullPath] : []
  })
}

describe('the dependency rule', () => {
  it('keeps every relative import in src/core pointing back into src/core', () => {
    const coreFiles = readdirSync(CORE_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => entry.name)

    expect(coreFiles.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const fileName of coreFiles) {
      const source = readFileSync(join(CORE_DIR, fileName), 'utf8')
      for (const specifier of extractImportSpecifiers(source)) {
        const isRelative = specifier.startsWith('.')
        if (isRelative && !specifier.startsWith('./')) {
          violations.push(`${fileName}: '${specifier}'`)
        }
      }
    }

    expect(violations, `src/core imports reaching outside src/core:\n${violations.join('\n')}`).toEqual([])
  })

  it('never lets src/server import toward src/web', () => {
    const serverFiles = listTsFilesRecursive(SERVER_DIR)

    expect(serverFiles.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const filePath of serverFiles) {
      const source = readFileSync(filePath, 'utf8')
      for (const specifier of extractImportSpecifiers(source)) {
        if (specifier.includes('/web/') || specifier.endsWith('/web')) {
          violations.push(`${filePath}: '${specifier}'`)
        }
      }
    }

    expect(violations, `src/server imports reaching toward src/web:\n${violations.join('\n')}`).toEqual([])
  })
})
