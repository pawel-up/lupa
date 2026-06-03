import type { ViteDevServer } from 'vite'
import { resolve, dirname } from 'node:path'

/**
 * Transforms a browser stack trace into filesystem-friendly paths
 * with accurate source-mapped line numbers.
 *
 * Uses Vite's client module graph to look up source maps for each
 * transformed module, then resolves original positions via
 * @jridgewell/trace-mapping.
 *
 * @param vite Vite dev server instance
 * @param cwd Current working directory
 * @param stack Stack trace to transform
 * @returns Transformed stack trace
 */
export async function transformBrowserStack(vite: ViteDevServer, cwd: string, stack: string): Promise<string> {
  const { TraceMap, originalPositionFor } = await import('@jridgewell/trace-mapping')
  const clientGraph = vite.environments?.client?.moduleGraph
  const lines = stack.split('\n')
  const transformed: string[] = []

  for (const line of lines) {
    // Filter out framework internals
    if (
      line.includes('/src/testing/') ||
      line.includes('/src/assert/') ||
      line.includes('/src/hooks/') ||
      line.includes('/src/network/')
    ) {
      continue
    }

    // Extract URL + line + column from the stack frame
    // Handles both `(url:line:col)` and bare `url:line:col`
    const urlMatch = line.match(/(https?:\/\/[^/]+)(\/[^\s)]*?):(\d+):(\d+)/)
    if (urlMatch) {
      const [, origin, urlPath, lineStr, colStr] = urlMatch
      // Strip query params (e.g. ?import) for module lookup
      const cleanPath = urlPath.replace(/\?[^:]*$/, '')

      // Convert Vite URL path to filesystem path
      // /@fs/absolute/path → /absolute/path
      // /@fsrelative/path → {cwd}/relative/path (missing / after @fs)
      // /relative/path → {cwd}/relative/path
      let fsPath: string
      if (cleanPath.startsWith('/@fs/')) {
        fsPath = cleanPath.slice(4) // remove /@fs prefix, keep leading /
      } else if (cleanPath.startsWith('/@fs')) {
        fsPath = resolve(cwd, cleanPath.slice(4)) // /@fsrelative → cwd/relative
      } else {
        fsPath = resolve(cwd, cleanPath.slice(1)) // /relative → cwd/relative
      }

      // Try source map resolution via Vite's client module graph
      if (clientGraph) {
        try {
          const mod = await clientGraph.getModuleByUrl(cleanPath)
          if (mod?.transformResult?.map) {
            const tracer = new TraceMap(mod.transformResult.map as any)
            const pos = originalPositionFor(tracer, {
              line: parseInt(lineStr),
              column: parseInt(colStr) - 1, // source maps use 0-based columns
            })
            if (pos.source && pos.line != null) {
              const resolvedSource = pos.source.startsWith('/') ? pos.source : resolve(dirname(fsPath), pos.source)
              const newLocation = `${resolvedSource}:${pos.line}:${(pos.column ?? 0) + 1}`
              const fullMatch = `${origin}${urlPath}:${lineStr}:${colStr}`
              transformed.push(line.replace(fullMatch, newLocation))
              continue
            }
          }
        } catch {
          // Fall through to filesystem-path-only mapping
        }
      }

      // Fallback: use filesystem path with original (un-source-mapped) line numbers
      const fullMatch = `${origin}${urlPath}:${lineStr}:${colStr}`
      transformed.push(line.replace(fullMatch, `${fsPath}:${lineStr}:${colStr}`))
      continue
    }

    transformed.push(line)
  }
  return transformed.join('\n')
}
