import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(__dirname, '..', '..')
const CORE_DIR = join(REPO_ROOT, 'src', 'core')
const SERVER_DIR = join(REPO_ROOT, 'src', 'server')
const WEB_DIR = join(REPO_ROOT, 'src', 'web')

/** Matches an `import ... from '...'` or `export ... from '...'` clause, single or double quotes. */
const IMPORT_SPECIFIER_RE = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g
/** Matches a bare side-effect `import '...'` with no clause, e.g. `import './index.css'`. */
const SIDE_EFFECT_IMPORT_RE = /(?:^|[\n;])\s*import\s+['"]([^'"]+)['"]/g
/** Matches `import('...')`, react-router's lazy-route idiom. */
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

function extractImportSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_SPECIFIER_RE)].map((match) => match[1] as string)
}

/**
 * Every import form src/web can plausibly use, not just `import ... from`:
 * a bare side-effect import (`import './index.css'`) and a dynamic
 * `import('./Page.js')` (react-router's lazy-route idiom) would otherwise
 * slip straight past the dependency rule below.
 */
function extractAllImportSpecifiers(source: string): string[] {
  return [IMPORT_SPECIFIER_RE, SIDE_EFFECT_IMPORT_RE, DYNAMIC_IMPORT_RE].flatMap((re) =>
    [...source.matchAll(re)].map((match) => match[1] as string),
  )
}

/** `.ts` and `.tsx` — src/web has components the original `.ts`-only walker would silently skip. */
function listSourceFilesRecursive(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFilesRecursive(fullPath)
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [fullPath] : []
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

    expect(
      violations,
      `src/core imports reaching outside src/core:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('never lets src/server import toward src/web', () => {
    const serverFiles = listSourceFilesRecursive(SERVER_DIR)

    expect(serverFiles.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const filePath of serverFiles) {
      const source = readFileSync(filePath, 'utf8')
      // extractAllImportSpecifiers (not just from-clause imports) so a bare
      // side-effect import or dynamic import() toward web can't slip past
      // this check the way it couldn't past the web-boundary check below.
      for (const specifier of extractAllImportSpecifiers(source)) {
        if (specifier.includes('/web/') || specifier.endsWith('/web')) {
          violations.push(`${filePath}: '${specifier}'`)
        }
      }
    }

    expect(
      violations,
      `src/server imports reaching toward src/web:\n${violations.join('\n')}`,
    ).toEqual([])
  })

  it('lets src/web import npm packages and its own files freely, but only money/split from core, and never server', () => {
    // Per CLAUDE.md's architecture note: src/web never imports src/server —
    // not even a type — and may import src/core inward only for
    // core/money.ts and core/split.ts (types freely, runtime for parsing,
    // formatting, and a read-only preview). core/settle.ts is off limits:
    // balances and transfers come from the server, the only authority on
    // what a group owes.
    const webFiles = listSourceFilesRecursive(WEB_DIR)

    expect(webFiles.length).toBeGreaterThan(0)

    const violations: string[] = []
    for (const filePath of webFiles) {
      const source = readFileSync(filePath, 'utf8')
      for (const specifier of extractAllImportSpecifiers(source)) {
        // Bare specifiers are npm packages (react, react-router, ...) — always allowed.
        if (!specifier.startsWith('.')) continue

        // Resolved against the importing file's own directory, not matched
        // as a substring — this catches '../../core/settle.js' and
        // '../../../src/server/app.js' uniformly, and can't be fooled by a
        // path that merely contains the word 'web'. The target need not
        // exist on disk: relative imports here use explicit '.js'
        // extensions pointing at '.ts'/'.tsx' sources, matching the rest of
        // the repo's convention.
        const resolved = resolve(dirname(filePath), specifier)
        const underWeb = resolved === WEB_DIR || resolved.startsWith(WEB_DIR + sep)
        const isAllowedCoreModule =
          resolved === join(CORE_DIR, 'money.js') ||
          resolved === join(CORE_DIR, 'split.js')

        if (!underWeb && !isAllowedCoreModule) {
          violations.push(`${filePath}: '${specifier}'`)
        }
      }
    }

    expect(
      violations,
      `src/web imports reaching outside its allowlist:\n${violations.join('\n')}`,
    ).toEqual([])
  })
})
