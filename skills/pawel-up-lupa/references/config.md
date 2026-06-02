# Lupa Configuration Reference

This file contains the configuration schema for `lupa.config.ts`. Use this to configure the test runner, setup plugins, manage coverage, and customize the HTML harness.

## Basic Example `lupa.config.ts`

```typescript
import { defineConfig } from '@pawel-up/lupa'

export default defineConfig({
  // Run tests in parallel across browser pages
  parallel: true,
  concurrency: 'auto',

  // Default timeout for all tests
  timeout: 5000,

  // Setup plugins
  testPlugins: [
    '@pawel-up/lupa/assert'
  ],

  coverage: {
    enabled: true,
    include: ['src/**/*.ts'],
    exclude: ['test/**']
  },



  // Override or provide inline Vite configuration
  vite: {
    resolve: {
      alias: {
        '@/': '/src/'
      }
    }
  },

  // Customize the HTML harness
  harness: {
    stylesheets: ['/src/styles/main.css'],
    template: ({ scripts, stylesheets }) => `
      <!DOCTYPE html>
      <html>
        <head>
          ${stylesheets}
        </head>
        <body>
          <script src="/src/setup.js" type="module"></script>
          ${scripts}
        </body>
      </html>
    `
  }
})
```

## Core Configuration Interfaces

```typescript
export interface BaseConfig {
  cwd: string
  watch?: boolean
  timeout?: number
  retries?: number
  filters?: Filters
  testPlugins?: string[]
  runnerPlugins?: LupaPlugin[]
  exclude?: string[]
  viteConfig?: string
  vite?: InlineConfig // From vite
  coverage?: boolean | CoverageOptions
  harness?: HarnessConfig
  parallel?: boolean
  concurrency?: number | 'auto'
  list?: boolean
}

export interface HarnessConfig {
  // Custom HTML template string or function returning HTML
  template?: string | ((context: { scripts: string; stylesheets: string }) => string)
  stylesheets?: string[] // Paths to CSS files to inject
}

export interface CoverageOptions {
  enabled?: boolean // Explicitly toggle coverage (defaults to false)
  include?: string[] // Glob patterns to include in coverage reports
  exclude?: string[] // Glob patterns to exclude from coverage reports
  extension?: string[] // File extensions to process
  reporters?: string[] // List of coverage reporters to run simultaneously (default: ['text-summary', 'html'])
  reportsDirectory?: string // Output directory for reports (default: './coverage')
  thresholds?: {
    lines?: number
    functions?: number
    branches?: number
    statements?: number
  }
}

export interface SemanticDomOptions {
  ignoredAttributes?: "*" | (string | AttributeMatcher)[]
  ignoreAttributeValueFor?: (string | AttributeMatcher)[]
  ignoreTags?: string[]
  ignoreChildren?: string[]
  ignoreTextContent?: boolean
}
```

## Locator & Action Options

When interacting with the DOM via commands or locators, Lupa supports Playwright-like options:

- `ClickOptions`: `{ button?: 'left' | 'right' | 'middle', clickCount?: number, delay?: number, force?: boolean, modifiers?: string[], position?: { x: number, y: number } }`
- `TypeOptions`: `{ delay?: number }`
- `CheckOptions`: `{ force?: boolean }`
- `FillOptions`: `{ force?: boolean }`
- `HoverOptions`: `{ force?: boolean, position?: { x: number, y: number }, modifiers?: string[] }`
