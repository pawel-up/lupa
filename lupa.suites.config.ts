import path from 'node:path'
import { defineConfig } from './src/runner/index.js'
import type { Assert } from './src/assert/index.js'
import type { Network } from './src/network/index.js'
import { moduleMocking } from './src/module-mock/index.js'
import type { ModuleMock } from './src/module-mock/index.js'

export default defineConfig({
  suites: [
    {
      name: 'Unit Tests',
      files: ['tests/fixtures/unit/**/*.spec.ts'],
    },
    {
      name: 'Integration Tests',
      files: ['tests/fixtures/integration/**/*.spec.ts'],
    },
  ],
  testPlugins: [path.join(process.cwd(), 'src/assert/index.ts'), path.join(process.cwd(), 'src/network/index.ts')],
  runnerPlugins: [moduleMocking()],
  reporters: {
    activated: ['progress'],
  },
  harness: {
    stylesheets: [path.join(process.cwd(), 'tests/fixtures/test.styles.css')],
    template: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='gradient_L' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%230047AB;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%2300FFFF;stop-opacity:1' /%3E%3C/linearGradient%3E%3ClinearGradient id='gradient_handle' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%2300FFFF;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%230047AB;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='%231A2233'/%3E%3Cpath d='M 30 20 L 30 80 L 70 80' fill='none' stroke='url(%23gradient_L)' stroke-width='10' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='55' cy='45' r='15' fill='none' stroke='url(%23gradient_handle)' stroke-width='6'/%3E%3Cline x1='65' y1='55' x2='80' y2='70' stroke='url(%23gradient_handle)' stroke-width='6' stroke-linecap='round'/%3E%3C/svg%3E">
          <style>
            .a-special-inlined-style-tag {
              border-radius: 8px;
            }
          </style>
          <!-- lupa-stylesheets -->
        </head>
        <body>
          <!-- lupa-scripts -->
        </body>
      </html>
    `,
  },
})

// @ts-expect-error We are modifying the TestContext interface to add our custom plugins.
declare module './src/testing/index.js' {
  interface TestContext {
    assert: Assert
    network: Network
    module: ModuleMock
  }
}
