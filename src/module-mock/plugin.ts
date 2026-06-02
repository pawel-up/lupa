import fs from 'node:fs'
import { init, parse } from 'es-module-lexer'
import MagicString from 'magic-string'
import type { Plugin } from 'vite'

const MOCK_ID_PARAM = 'lupa-mock-id'

/**
 * Normalize a path to the canonical registry key used by both fixture.ts (browser)
 * and plugin.ts (Node/Vite load hook).
 *
 * The browser's `new URL(path, import.meta.url).pathname` on a `/@fs/…` base URL
 * produces the absolute FS path (e.g. `/Users/…/src/calculator.js`).
 * The Vite load hook receives the resolved absolute FS path (e.g. `/Users/…/src/calculator.ts`).
 * Both sides normalize .ts/.tsx → .js so they always agree.
 */
export function toRegistryKey(filePath: string): string {
  // Strip /@fs only if it appears as a URL prefix before an absolute path —
  // the browser pathname already includes it in some Vite setups.
  const withoutFs = filePath.startsWith('/@fs/') ? filePath.slice(4) : filePath
  return withoutFs.replace(/\.tsx?$/, '.js')
}

/**
 * Extract the lupa-mock-id query param from a module id, or return null.
 */
function extractMockId(id: string): { filePath: string; testId: string } | null {
  const qIndex = id.indexOf('?')
  if (qIndex === -1) return null

  const params = new URLSearchParams(id.slice(qIndex + 1))
  const testId = params.get(MOCK_ID_PARAM)
  if (!testId) return null

  return { filePath: id.slice(0, qIndex), testId }
}

/**
 * Whether a specifier should have the mock-id appended.
 * Skip bare package names (no leading . or /) and protocol specifiers (node:, npm:, etc.).
 */
function isRelativeOrAbsoluteSpecifier(spec: string): boolean {
  return spec.startsWith('.') || spec.startsWith('/')
}

/**
 * Vite plugin that implements Cascading Cache-Busting for ESM module mocking.
 *
 * - `resolveId` hook: Strips the mock-id param, delegates to Vite's normal resolver
 *   (which maps `.js` → `.ts`), then reattaches the param. Without this, Vite
 *   returns a 404 for `.js` paths that only exist on disk as `.ts`.
 *
 * - `load` hook (Interceptor): If a file is registered as mocked for a given testId,
 *   read its real exports via es-module-lexer and return a synthetic module that
 *   binds those exports to `window.__LUPA_MOCKS__[testId][path]`.
 *
 * - `transform` hook (Cascader): For any file loaded with a `?lupa-mock-id` param,
 *   rewrite all its import specifiers to include the same param, so the entire
 *   dependency subtree is also fetched fresh and may be intercepted.
 */
export function moduleMockVitePlugin(): Plugin {
  return {
    name: 'lupa:module-mock',
    enforce: 'pre',

    async resolveId(source, importer, options) {
      const parsed = extractMockId(source)
      if (!parsed) return null

      let filePath = parsed.filePath

      // Strip /@fs prefix — Vite uses this for out-of-root absolute paths in the
      // browser, but it's not a valid filesystem path for resolution.
      if (filePath.startsWith('/@fs')) {
        filePath = filePath.slice(4)
      }

      // Try the path as-is first (handles .ts files and already-correct paths).
      // If that fails, try swapping .js → .ts (the common TS source case).
      const candidates = [filePath]
      if (filePath.endsWith('.js')) {
        candidates.push(filePath.slice(0, -3) + '.ts')
        candidates.push(filePath.slice(0, -3) + '.tsx')
      }

      for (const candidate of candidates) {
        const resolved = await this.resolve(candidate, importer, {
          ...options,
          skipSelf: true,
        })
        if (resolved) {
          return `${resolved.id}?${MOCK_ID_PARAM}=${parsed.testId}`
        }
      }

      return null
    },

    async load(id) {
      const parsed = extractMockId(id)
      if (!parsed) return null

      const { filePath, testId } = parsed

      // The key must match what fixture.ts stored: the absolute FS path with .js extension.
      // fixture.ts computes: toRegistryKey(new URL(path, import.meta.url).pathname)
      // where import.meta.url in the browser is `http://localhost:5173/@fs/Users/…/file.ts`,
      // so pathname = `/Users/…/calculator.js` — the full absolute FS path.
      const registryKey = toRegistryKey(filePath)

      // __real__ is the sentinel used by fixture.ts to pre-load the real exports for merging.
      // Let it fall through so Vite serves the real compiled file.
      if (testId === '__real__') return null

      // Read the real source to discover export names.
      let src: string
      try {
        src = fs.readFileSync(filePath, 'utf-8')
      } catch {
        this.warn(`module-mock: could not read ${filePath}`)
        return null
      }

      await init
      const [, exports] = parse(src)

      const mockRef = JSON.stringify(testId)
      const pathRef = JSON.stringify(registryKey)

      // Read mock values for this path. For unmocked transitive deps the entry is absent
      // and __m__ is {}, so their exports are undefined — callers only reach here when
      // the whole import chain was kicked off by module.import(), meaning the test
      // intentionally loaded this subtree and any transitive dep it cares about should
      // also have been mocked via module.mock().
      const lines: string[] = [`const __m__ = (window.__LUPA_MOCKS__ ?? {})[${mockRef}]?.[${pathRef}] ?? {}`]

      for (const exp of exports) {
        const name = exp.n
        if (name !== 'default') {
          lines.push(`export const ${name} = __m__[${JSON.stringify(name)}]`)
        }
      }

      // Always emit a default export to avoid SyntaxError when a consumer imports it.
      lines.push(`export default __m__[${JSON.stringify('default')}]`)

      return lines.join('\n')
    },

    async transform(code, id) {
      const parsed = extractMockId(id)
      if (!parsed) return null

      const { testId } = parsed

      await init
      const [imports] = parse(code)
      if (!imports.length) return null

      const s = new MagicString(code)

      for (const imp of imports) {
        const spec = imp.n
        if (!spec || !isRelativeOrAbsoluteSpecifier(spec)) continue

        const rawChunk = code.slice(imp.s, imp.e)

        const qIndex = spec.indexOf('?')
        let newSpec: string
        if (qIndex === -1) {
          newSpec = `${spec}?${MOCK_ID_PARAM}=${testId}`
        } else {
          const existing = new URLSearchParams(spec.slice(qIndex + 1))
          existing.set(MOCK_ID_PARAM, testId)
          newSpec = `${spec.slice(0, qIndex)}?${existing.toString()}`
        }

        const specStart = code.indexOf(rawChunk, imp.s)
        if (specStart !== -1) {
          s.overwrite(specStart, specStart + rawChunk.length, newSpec)
        }
      }

      if (!s.hasChanged()) return null

      return { code: s.toString(), map: s.generateMap({ hires: true }) }
    },
  }
}
