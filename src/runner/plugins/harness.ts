import { type IncomingMessage, type ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ViteDevServer } from 'vite'
import type { JsonSerializable, NormalizedConfig } from '../types.js'
import type { TestPoolManager } from '../test_pool_manager.js'

/**
 * Creates the Vite plugin responsible for generating the Lupa test harness HTML.
 * Exported for testing purposes.
 */
export default function harnessPlugin(
  testPoolManager: TestPoolManager,
  resolvedPlugins: (JsonSerializable | undefined)[][],
  runnerConfig: NormalizedConfig,
  harnessPath: string
) {
  return {
    name: 'lupa-harness',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/__lupa__/runner.html', async (req: IncomingMessage, res: ServerResponse) => {
        const host = req.headers?.host || 'localhost'
        const url = new URL(req.url || '/', `http://${host}`)
        const chunkId = url.searchParams.get('chunkId')

        const chunk = chunkId ? testPoolManager.getChunk(chunkId) : undefined
        const suitesToRun = chunk ? chunk.suites : []

        const configPayload = JSON.stringify({
          chunkId,
          suites: suitesToRun.map((s) => {
            const allowedFiles = runnerConfig?.filters?.files
            let filteredUrls = s.filesURLs

            if (allowedFiles && allowedFiles.length > 0) {
              filteredUrls = s.filesURLs.filter((u) => {
                const path = import.meta.url ? fileURLToPath(u) : u.pathname
                // Watch manager passes absolute paths in allowedFiles
                // The CLI might pass partial paths.
                return allowedFiles.some((allowed) => path.endsWith(allowed))
              })
            }

            return {
              name: s.name,
              timeout: s.timeout,
              retries: s.retries,
              files: filteredUrls.map((u) => fileURLToPath(u)),
            }
          }),
          testPlugins: resolvedPlugins,
          config: {
            filters: runnerConfig?.filters,
            timeout: runnerConfig?.timeout,
            retries: runnerConfig?.retries,
            list: runnerConfig?.list,
          },
        })

        const scripts = `
          <script>window.__lupa__ = ${configPayload}</script>
          <script type="module" src="/@fs${harnessPath}"></script>
        `

        const stylesheets = (runnerConfig?.harness?.stylesheets || [])
          .map((cssPath) => {
            if (cssPath.startsWith('http://') || cssPath.startsWith('https://')) {
              return `<link rel="stylesheet" href="${cssPath}">`
            }
            const resolved = resolve(process.cwd(), cssPath)
            return `<link rel="stylesheet" href="/@fs${resolved}">`
          })
          .join('\n')

        let html: string
        if (typeof runnerConfig?.harness?.template === 'function') {
          html = runnerConfig.harness.template({ scripts, stylesheets })
        } else if (typeof runnerConfig?.harness?.template === 'string') {
          html = runnerConfig.harness.template
            .replace('<!-- lupa-scripts -->', scripts)
            .replace('<!-- lupa-stylesheets -->', stylesheets)
        } else {
          html = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>Lupa Test Runner</title>
                <base href="/">
                ${stylesheets}
              </head>
              <body>
                ${scripts}
              </body>
            </html>
          `
        }

        // Auto-inject base href for custom templates if missing, to ensure
        // relative fetches resolve against the workspace root instead of /__lupa__/
        if (!html.includes('<base ') && html.includes('<head>')) {
          html = html.replace('<head>', '<head>\n    <base href="/">')
        }

        res.setHeader('Content-Type', 'text/html')
        res.end(html)
      })
    },
  }
}
