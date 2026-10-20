import test from 'node:test'
import assert from 'node:assert/strict'
import lupaHarnessPlugin from '../../../src/runner/plugins/harness.js'
import type { NormalizedConfig } from '../../../src/runner/types.js'
import type { ViteDevServer } from 'vite'
import type { TestPoolManager } from '../../../src/runner/test_pool_manager.js'

test('Lupa Harness Middleware', async (t) => {
  await t.test('generates default HTML with stylesheets', async () => {
    const config = {
      harness: {
        stylesheets: ['styles/reset.css', 'https://fonts.googleapis.com/css2?family=Inter'],
      },
    } as unknown as NormalizedConfig

    const poolMock = { getChunk: () => ({ suites: [] }) } as unknown as TestPoolManager
    const plugin = lupaHarnessPlugin(poolMock, [], config, '/fake-harness.js')

    let responseContent = ''
    const res = {
      setHeader: () => {},
      end: (content: string) => {
        responseContent = content
      },
    }

    const mockServer = {
      middlewares: {
        use: (path: string, handler: any) => {
          if (path === '/__lupa__/runner.html') {
            handler({}, res)
          }
        },
      },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)

    assert.ok(responseContent.includes('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">'))
    assert.ok(responseContent.includes('styles/reset.css'))
  })

  await t.test('generates HTML using custom string template', async () => {
    const config = {
      harness: {
        template: '<html><head><!-- lupa-stylesheets --></head><body><!-- lupa-scripts --></body></html>',
        stylesheets: ['styles.css'],
      },
    } as unknown as NormalizedConfig

    const poolMock = { getChunk: () => ({ suites: [] }) } as unknown as TestPoolManager
    const plugin = lupaHarnessPlugin(poolMock, [], config, '/fake-harness.js')

    let responseContent = ''
    const res = {
      setHeader: () => {},
      end: (content: string) => {
        responseContent = content
      },
    }

    const mockServer = {
      middlewares: {
        use: (path: string, handler: any) => {
          if (path === '/__lupa__/runner.html') {
            handler({}, res)
          }
        },
      },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)

    assert.ok(responseContent.includes('<html><head>\n    <base href="/"><link rel="stylesheet" href="'))
    assert.ok(responseContent.includes('styles.css'))
    assert.ok(responseContent.includes('<script>window.__lupa__ ='))
    assert.ok(responseContent.includes('</body></html>'))
  })

  await t.test('generates HTML using custom function template', async () => {
    const config = {
      harness: {
        template: ({ scripts, stylesheets }: any) => `CUSTOM-${stylesheets}-${scripts}`,
        stylesheets: ['https://cdn.example.com/theme.css'],
      },
    } as unknown as NormalizedConfig

    const poolMock = { getChunk: () => ({ suites: [] }) } as unknown as TestPoolManager
    const plugin = lupaHarnessPlugin(poolMock, [], config, '/fake-harness.js')

    let responseContent = ''
    const res = {
      setHeader: () => {},
      end: (content: string) => {
        responseContent = content
      },
    }

    const mockServer = {
      middlewares: {
        use: (path: string, handler: any) => {
          if (path === '/__lupa__/runner.html') {
            handler({}, res)
          }
        },
      },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)

    assert.ok(responseContent.startsWith('CUSTOM-'))
    assert.ok(responseContent.includes('<link rel="stylesheet" href="https://cdn.example.com/theme.css">'))
    assert.ok(responseContent.includes('window.__lupa__ ='))
  })

  await t.test('filters suites to requested file when ?file= query param is provided', async () => {
    const config = {} as NormalizedConfig
    const poolMock = {
      getChunk: () => ({
        id: 'chromium-0',
        browserName: 'chromium',
        suites: [
          {
            name: 'default',
            filesURLs: [new URL('file:///app/tests/a.spec.ts'), new URL('file:///app/tests/b.spec.ts')],
          },
        ],
      }),
      getChunkIdForFile: () => 'chromium-0',
    } as unknown as TestPoolManager

    const plugin = lupaHarnessPlugin(poolMock, [], config, '/fake-harness.js')

    let responseContent = ''
    const res = {
      setHeader: () => {},
      end: (content: string) => {
        responseContent = content
      },
    }

    const mockServer = {
      middlewares: {
        use: (path: string, handler: any) => {
          if (path === '/__lupa__/runner.html') {
            handler({ url: '/__lupa__/runner.html?chunkId=chromium-0&debug=1&file=%2Fapp%2Ftests%2Fa.spec.ts' }, res)
          }
        },
      },
    } as unknown as ViteDevServer

    plugin.configureServer(mockServer)

    assert.ok(responseContent.includes('<script>window.__lupa__ ='))
    assert.ok(responseContent.includes('/app/tests/a.spec.ts'))
    assert.ok(!responseContent.includes('/app/tests/b.spec.ts'))
  })
})
