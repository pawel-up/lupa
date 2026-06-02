import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import type { InlineConfig } from 'vite'
import type { Page } from 'playwright'
// @ts-expect-error - c8 does not provide types natively
import c8Report from 'c8/lib/report.js'
import debug from './debug.js'
import type { CoverageOptions } from './types.js'
import type { ExceptionsManager } from './exceptions_manager.js'

const requireModule = createRequire(import.meta.url)

interface LineState {
  insideComment: boolean
  insideInterface: boolean
  interfaceBraces: number
  insideType: boolean
  typeBraces: number
  insideImport: boolean
}

function shouldIgnoreLine(lineStr: string, state: LineState): boolean {
  const trimmed = lineStr.trim()
  if (trimmed === '') return true

  // 1. Comments
  if (state.insideComment) {
    if (trimmed.includes('*/')) {
      state.insideComment = false
    }
    return true
  }
  if (trimmed.startsWith('/*')) {
    if (!trimmed.includes('*/')) {
      state.insideComment = true
    }
    return true
  }
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
    return true
  }

  // 2. Imports/Exports of types
  if (state.insideImport) {
    if (trimmed.includes('}')) {
      state.insideImport = false
    }
    return true
  }
  if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) {
    if (trimmed.includes('{') && !trimmed.includes('}')) {
      state.insideImport = true
    }
    return true
  }

  // export type/interface/ambient
  if (
    trimmed.startsWith('export type ') ||
    trimmed.startsWith('type ') ||
    trimmed.startsWith('export interface ') ||
    trimmed.startsWith('interface ')
  ) {
    if (trimmed.includes('{')) {
      if (trimmed.startsWith('interface') || trimmed.startsWith('export interface')) {
        state.insideInterface = true
        state.interfaceBraces = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length
      } else {
        state.insideType = true
        state.typeBraces = (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length
      }
    }
    return true
  }

  if (state.insideInterface) {
    state.interfaceBraces += (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length
    if (state.interfaceBraces <= 0) {
      state.insideInterface = false
    }
    return true
  }

  if (state.insideType) {
    state.typeBraces += (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length
    if (state.typeBraces <= 0) {
      state.insideType = false
    }
    return true
  }

  // 3. Class field declarations without initializers
  const hasColon = trimmed.includes(':')
  const hasEquals = trimmed.includes('=')
  const hasBrace = trimmed.includes('{')
  const isClassOrFunction = trimmed.includes('class ') || trimmed.includes('function ') || trimmed.includes('=>')
  const modifiers = ['public', 'private', 'protected', 'readonly', 'static', 'declare', 'accessor']
  const startsWithModifier = modifiers.some((m) => trimmed.startsWith(m))
  const isFieldDecl =
    (startsWithModifier || /^[#a-zA-Z0-9_$]+\??\s*:/.test(trimmed)) &&
    hasColon &&
    !hasEquals &&
    !hasBrace &&
    !isClassOrFunction &&
    !trimmed.startsWith('default:')

  if (isFieldDecl) {
    return true
  }

  // 4. Decorators
  if (trimmed.startsWith('@')) {
    return true
  }

  // 5. Brackets/closing braces on their own
  if (
    trimmed === '}' ||
    trimmed === '};' ||
    trimmed === ']' ||
    trimmed === '];' ||
    trimmed === ')' ||
    trimmed === ');'
  ) {
    return true
  }

  // 6. Function/Method declaration lines (ending with `{` and contains `(' and `)`)
  const isControlFlow =
    trimmed.startsWith('if') ||
    trimmed.startsWith('for') ||
    trimmed.startsWith('while') ||
    trimmed.startsWith('switch') ||
    trimmed.startsWith('catch')
  if (trimmed.endsWith('{') && trimmed.includes('(') && trimmed.includes(')') && !isControlFlow) {
    return true
  }

  return false
}

interface CovLine {
  line: number
  startCol: number
  endCol: number
  count: number
  ignore: boolean
}

interface CovSourceEntry {
  path: string
  source: {
    lines: CovLine[]
  }
}

interface V8ToIstanbulInstance {
  covSources: CovSourceEntry[]
  load(): Promise<void>
}

// Monkey-patch v8-to-istanbul's `load` method.
//
// WHY WE DO THIS:
// Native V8 coverage operates on compiled JS files and maps results back to the original source.
// Since TypeScript types, interfaces, comments, and uninitialized class fields do not emit
// any executable JavaScript code, they map to no V8 execution blocks. V8 (and c8) defaults to
// treating these unmapped source ranges as completely uncovered statements (0% hit count).
// This is especially problematic when 'c8' is run in 'all: true' mode (triggered by inclusion glob config),
// which scans files that were not fully executed and marks every unmapped line as uncovered.
//
// By intercepting `V8ToIstanbul.prototype.load`, we post-process the mapped line-by-line coverage
// entries for all TypeScript files and flag non-executable lines as ignored (`line.ignore = true`),
// preventing them from artificially bringing down the codebase's coverage report score.
try {
  const V8ToIstanbul = requireModule('v8-to-istanbul/lib/v8-to-istanbul')
  const originalLoad = V8ToIstanbul.prototype.load as (this: V8ToIstanbulInstance) => Promise<void>

  V8ToIstanbul.prototype.load = async function (this: V8ToIstanbulInstance): Promise<void> {
    await originalLoad.call(this)

    for (const covSourceEntry of this.covSources) {
      const filePath = covSourceEntry.path
      const isTypeScript = filePath && /\.(ts|tsx|mts|cts)$/.test(filePath)
      if (isTypeScript && fs.existsSync(filePath)) {
        try {
          const rawSource = fs.readFileSync(filePath, 'utf8')
          const lineStrings = rawSource.split(/(?<=\r?\n)/u)
          const lines = covSourceEntry.source.lines

          const state: LineState = {
            insideComment: false,
            insideInterface: false,
            interfaceBraces: 0,
            insideType: false,
            typeBraces: 0,
            insideImport: false,
          }

          lineStrings.forEach((lineStr, index) => {
            if (shouldIgnoreLine(lineStr, state)) {
              if (lines[index]) {
                lines[index].ignore = true
              }
            }
          })
        } catch {
          // Ignore failures to read file, keep original coverage unmodified
        }
      }
    }
  }
} catch (e) {
  debug('Failed to apply TypeScript coverage filter patch: %O', e)
}

export class CoverageManager {
  #coverageConfig: boolean | CoverageOptions | undefined
  #globalExcludes: string[]
  #tempDir?: string

  constructor(coverageConfig: boolean | CoverageOptions | undefined, globalExcludes: string[] = []) {
    this.#coverageConfig = coverageConfig
    this.#globalExcludes = globalExcludes
  }

  /**
   * Checks if coverage reporting is enabled in the configuration.
   */
  get isEnabled(): boolean {
    return !!this.#coverageConfig
  }

  /**
   * Lazily creates and returns a unique temporary directory under the OS temporary directory.
   */
  getTempDir(): string {
    if (!this.#tempDir) {
      const osTempDir = os.tmpdir()
      this.#tempDir = fs.mkdtempSync(path.join(osTempDir, 'lupa-coverage-'))
      debug('Created temporary V8 coverage directory at %s', this.#tempDir)
    }
    return this.#tempDir
  }

  /**
   * Configures Vite to enable dev and build sourcemaps for accurate coverage mapping.
   */
  async instrumentViteConfig(viteConfig: InlineConfig): Promise<void> {
    if (!this.isEnabled) return

    // Ensure CSS source maps are enabled for dev
    viteConfig.css = viteConfig.css || {}
    viteConfig.css.devSourcemap = true

    // Ensure dev/build JS source maps are enabled
    viteConfig.build = viteConfig.build || {}
    viteConfig.build.sourcemap = true

    // Prevent Vite's file watcher from reloading pages when c8 writes coverage reports.
    const coverageOpts = typeof this.#coverageConfig === 'object' ? this.#coverageConfig : {}
    const reportsDirectory = coverageOpts.reportsDirectory || './coverage'
    const root = viteConfig.root || process.cwd()
    const reportsDir = path.resolve(root, reportsDirectory)
    const reportsDirPattern = path.join(reportsDir, '**').replace(/\\/g, '/')

    viteConfig.server = viteConfig.server || {}
    viteConfig.server.watch = viteConfig.server.watch || {}

    const currentIgnored = viteConfig.server.watch.ignored
    if (!currentIgnored) {
      viteConfig.server.watch.ignored = [reportsDirPattern]
    } else if (Array.isArray(currentIgnored)) {
      viteConfig.server.watch.ignored = [...currentIgnored, reportsDirPattern]
    } else {
      viteConfig.server.watch.ignored = [currentIgnored, reportsDirPattern]
    }
  }

  /**
   * Starts JavaScript coverage on the page if running on Chromium.
   */
  async startCoverage(page: Page, browserName: string): Promise<void> {
    if (!this.isEnabled) return

    if (browserName === 'chromium') {
      debug('Starting JSCoverage on Playwright page')
      await page.coverage.startJSCoverage({ resetOnNavigation: false })
    }
  }

  /**
   * Stops JSCoverage, processes dynamic URLs and inline source maps, and writes
   * the V8-compatible coverage payload to a temporary JSON file.
   */
  async collectPageCoverage(page: Page, browserName: string): Promise<void> {
    if (!this.isEnabled) return
    if (browserName !== 'chromium') return

    try {
      debug('Stopping JSCoverage for page')
      const coverage = await page.coverage.stopJSCoverage()

      interface V8CoverageResult {
        scriptId: string
        url: string
        functions: unknown[]
      }

      interface SourceMapCacheEntry {
        data: Record<string, unknown>
        lineLengths: number[]
      }

      const result: V8CoverageResult[] = []
      const sourceMapCache: Record<string, SourceMapCacheEntry> = {}

      for (const entry of coverage) {
        if (!entry.url || !entry.source) continue

        let parsedUrl: URL
        try {
          parsedUrl = new URL(entry.url)
        } catch {
          continue
        }

        // Only keep scripts served over http/https protocols from Vite dev server
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          continue
        }

        // Exclude internal Vite scripts
        const pathname = parsedUrl.pathname
        if (pathname.startsWith('/@vite/') || pathname.startsWith('/@id/')) {
          continue
        }

        // Map HTTP serving URL to local absolute path
        let filePath = ''
        if (pathname.startsWith('/@fs/')) {
          filePath = pathname.slice(4)
        } else {
          filePath = path.join(process.cwd(), pathname)
        }

        filePath = path.resolve(filePath)

        if (!fs.existsSync(filePath)) {
          continue
        }

        // Extract inline base64 source map injected by Vite
        let sourceMap: Record<string, unknown> | null = null
        const match = entry.source.match(
          /\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)/
        )
        if (match) {
          try {
            const base64 = match[1]
            const jsonStr = Buffer.from(base64, 'base64').toString('utf8')
            sourceMap = JSON.parse(jsonStr) as Record<string, unknown>
          } catch (e) {
            debug('Failed to parse source map for %s: %O', filePath, e)
          }
        }

        result.push({
          scriptId: entry.scriptId || '0',
          url: filePath,
          functions: entry.functions as unknown[],
        })

        if (sourceMap) {
          const fileUrl = pathToFileURL(filePath).href
          const lineLengths = entry.source.split(/\r?\n/).map((line) => line.length)
          sourceMapCache[fileUrl] = {
            data: sourceMap,
            lineLengths,
          }
        }
      }

      if (result.length > 0) {
        const tempFile = path.join(
          this.getTempDir(),
          `coverage-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
        )
        const payload = {
          result,
          'source-map-cache': sourceMapCache,
        }
        await fs.promises.writeFile(tempFile, JSON.stringify(payload))
        debug('Saved page V8 coverage payload to %s', tempFile)
      }
    } catch (err) {
      console.error('Failed to collect page coverage:', err)
    }
  }

  /**
   * Compiles the coverage reports using c8's programmatic Report API and enforces threshold limits.
   */
  async generateReport(exceptionsManager: ExceptionsManager): Promise<void> {
    if (!this.isEnabled) return
    if (!this.#tempDir) {
      debug('No temporary coverage files were collected.')
      return
    }

    try {
      const coverageOpts = typeof this.#coverageConfig === 'object' ? this.#coverageConfig : {}
      const reportsDirectory = coverageOpts.reportsDirectory || './coverage'
      const reporters = coverageOpts.reporters || ['text-summary', 'html']

      debug('Instantiating c8 report generator')
      const report = c8Report({
        exclude: coverageOpts.exclude || [
          'node_modules/**',
          'test/**',
          'tests/**',
          '**/*.spec.ts',
          '**/*.test.ts',
          ...this.#globalExcludes,
        ],
        include: coverageOpts.include,
        extension: coverageOpts.extension || ['.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte'],
        reporter: reporters,
        reportsDirectory: reportsDirectory,
        tempDirectory: this.#tempDir,
        all: Array.isArray(coverageOpts.include) && coverageOpts.include.length > 0,
      })

      debug('Running c8 report compiler')
      await report.run()
      debug('Coverage reports generated successfully')

      // Validate coverage thresholds if specified
      if (coverageOpts.thresholds) {
        const map = await report.getCoverageMapFromAllCoverageFiles()
        const summary = map.getCoverageSummary()
        const thresholds = coverageOpts.thresholds

        const failures: string[] = []
        const metrics = ['lines', 'functions', 'branches', 'statements'] as const

        for (const metric of metrics) {
          const threshold = thresholds[metric]
          if (threshold !== undefined) {
            const pct = summary[metric]?.pct ?? 0
            if (pct < threshold) {
              failures.push(`Coverage threshold for ${metric} not met: ${pct}% (threshold: ${threshold}%)`)
            }
          }
        }

        if (failures.length > 0) {
          const errorMsg = `Coverage threshold check failed:\n` + failures.map((f) => `  - ${f}`).join('\n')
          exceptionsManager.notifyException(new Error(errorMsg))
        }
      }
    } catch (err) {
      console.error('Failed to generate coverage reports:', err)
    } finally {
      // Clean up temporary coverage directory
      try {
        if (this.#tempDir && fs.existsSync(this.#tempDir)) {
          debug('Removing temporary coverage directory: %s', this.#tempDir)
          fs.rmSync(this.#tempDir, { recursive: true, force: true })
          this.#tempDir = undefined
        }
      } catch (e) {
        debug('Failed to remove temp coverage dir: %O', e)
      }
    }
  }
}
