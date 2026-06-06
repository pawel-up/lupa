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
  poolManager: TestPoolManager,
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

        const chunk = chunkId ? poolManager.getChunk(chunkId) : undefined
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
                <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='gradient_L' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%230047AB;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%2300FFFF;stop-opacity:1' /%3E%3C/linearGradient%3E%3ClinearGradient id='gradient_handle' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%2300FFFF;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%230047AB;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='%231A2233'/%3E%3Cpath d='M 30 20 L 30 80 L 70 80' fill='none' stroke='url(%23gradient_L)' stroke-width='10' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='55' cy='45' r='15' fill='none' stroke='url(%23gradient_handle)' stroke-width='6'/%3E%3Cline x1='65' y1='55' x2='80' y2='70' stroke='url(%23gradient_handle)' stroke-width='6' stroke-linecap='round'/%3E%3C/svg%3E">
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
