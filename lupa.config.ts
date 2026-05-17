import path from 'node:path'
import { defineConfig } from './src/runner/index.js'
import { progress, json } from './src/reporters/index.js'
import type { Assert } from './src/assert/index.js'

export default defineConfig({
  files: ['tests/fixtures/integration/**/*.spec.ts'],
  testPlugins: [path.join(process.cwd(), 'src/assert/index.ts')],
  reporters: {
    activated: ['progress'],
    list: [progress(), json()],
  },
  harness: {
    stylesheets: [path.join(process.cwd(), 'tests/fixtures/test.styles.css')],
    template: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
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

declare module './src/testing/index.js' {
  interface TestContext {
    assert: Assert
  }
}
