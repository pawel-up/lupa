<p align="center">
  <img src="./assets/lupa-icon.svg" width="128" alt="Lupa Logo">
</p>

# Lupa 🔎
**Lupa** is a lightning-fast, Vite-powered browser testing framework specifically designed for testing Web Components and modern web interfaces. 

It runs your tests natively in real browsers (via Playwright) while leveraging Vite's incredibly fast module graph, Hot Module Replacement (HMR), and build pipeline. It completely bridges the gap between modern Node.js testing ergonomics and genuine browser DOM execution.

---

## Why Lupa?

When building Web Components, you need a test runner that executes code in a real browser environment to correctly test Shadow DOM, custom element lifecycles, and complex CSS. 

For years, tools like [`@web/test-runner`](https://modern-web.dev/docs/test-runner/overview/) and the broader `@open-wc/testing` ecosystem have been the gold standard for this. They are fantastic projects that paved the way for modern DOM testing. However, as the ecosystem has rapidly evolved around tools like Vite, those tools have started to fall a little behind in terms of developer experience, speed, and modern tooling integration.

Lupa was built to be the spiritual successor for modern, Vite-based workflows.

## Features

- **Native Browser Execution:** Tests run inside actual browsers (Chromium, Firefox, WebKit) via Playwright. No DOM mocks.
- **Lightning Fast:** Uses Vite as the dev server. No bundling required, resulting in instant boot times.
- **Intelligent Watch Mode:** A dependency-aware incremental test watcher. Change a component, and Lupa instantly re-runs *only* the tests that import it.
- **Interactive Debugging:** Focus on a single test file and press `d` to pop open a headed browser with Chrome DevTools already open and attached.
- **Network Interception:** Full control over network traffic via a lightweight, typed API to mock, route, and assert on HTTP requests made from the browser.
- **Test Grouping & Suites:** Organize your testing architecture intuitively with structured groups, tags, and execution suites.
- **Data-Driven Datasets:** Avoid boilerplate by feeding dynamic datasets into parameterized tests.
- **Browser-Specific Macros:** Create extensible test setups and custom assertions that run flawlessly inside the browser sandbox.

## The Japa Connection

If the API looks familiar, that's because Lupa is heavily inspired by and based on the incredible [Japa framework](https://japa.dev/). 

A lot of Lupa's core logic, CLI parsing, and reporter architecture was directly taken from their great work. However, Lupa is inherently different. While we strive to keep the API consistent with Japa, our execution environment (the browser) and our primary goals (DOM testing) mean there are some architectural and API differences tailored specifically for front-end developers.

## Quick Start Overview

Lupa avoids injecting a massive global CLI tool for executing tests. Instead, tests are configured and executed via a custom script (typically `lupa.config.ts`), giving you total control over the environment.

We provide a lightweight setup CLI to instantly scaffold this configuration for you.

### 1. Initialize Lupa

Run the interactive initialization command in your project root:

```bash
npx lupa init
```

This will automatically create your `lupa.config.ts` configuration file, set up your test directories, and scaffold example tests based on your preferences.

If you prefer to configure things manually, here is an example of what `npx lupa init` generates for your execution script:

```typescript
import { defineConfig } from '@pawel-up/lupa/runner'
import { spec } from '@pawel-up/lupa/reporters'
import type { Assert } from '@pawel-up/lupa/assert'

export default defineConfig({
  files: ['tests/**/*.spec.ts'],
  testPlugins: ['@pawel-up/lupa/assert'],
  reporters: {
    activated: ['progress'],
  },
})

declare module '@pawel-up/lupa/testing' {
  interface TestContext {
    assert: Assert
  }
}
```

### 2. Writing a Test

Write your tests using the beautiful, explicit Japa-style API alongside Lupa's built-in fixtures (which support both Lit templates and raw HTML strings):

```typescript
// tests/button.spec.ts
import { test, fixture, html } from '@pawel-up/lupa/testing'
import '../src/components/my-button.js'

test.group('My Button Component', () => {
  test('renders text correctly', async ({ assert }) => {
    // Renders the element to the DOM and waits for the next animation frame
    const el = await fixture(html`<my-button>Click Me</my-button>`)
    
    // Perform your assertions
    assert.include(el.textContent, 'Click Me')
    
    // The fixture is automatically unmounted and cleaned up after the test!
  })
})
```

### 3. Network Mocking

Lupa ships with powerful network interception, allowing you to seamlessly mock requests and assert on network traffic without modifying your application code.

```typescript
// tests/api.spec.ts
import { test, fixture, html } from '@pawel-up/lupa/testing'

test('mocks a network request', async ({ assert, network }) => {
  // 1. Setup the mock
  const mock = await network.mock('https://api.example.com/data', {
    status: 200,
    body: JSON.stringify({ success: true })
  })
  
  // 2. Trigger the network call from your component
  await fixture(html`<data-fetcher></data-fetcher>`)

  // 3. Ensure the request has settled before asserting
  await mock.assert.calledOnce()
  
  // 4. Safely read the snapshot of the captured request
  const req = mock.lastRequest()
  assert.equal(req?.method, 'GET')
})
```

### 4. Running the Tests

Execute your test script using a transpiler like `tsx`. You can run all test suites, or run specific suites by passing positional arguments or the `--suites` option:

```bash
npx lupa test
npx lupa test "Unit Tests" "Integration Tests"
npx lupa test --suites "Unit Tests" "Integration Tests"
```

For the ultimate developer experience, run it in **Watch Mode**:

```bash
npx lupa test --watch
```

### 5. Code Coverage

Lupa has native code coverage collection built directly on Playwright's Chromium V8 coverage engine and programmatic `c8` reports. This avoids slow build-time Istanbul instrumentation.

To enable code coverage, pass the `--coverage` flag:

```bash
npx lupa test --coverage
```

You can also override coverage settings directly from the command line (which automatically enables coverage):

```bash
# Specify coverage reporters (comma-separated or multiple flags)
npx lupa test --coverage-reporters html,lcov,text

# Specify output directory for coverage reports
npx lupa test --coverage-dir ./custom-coverage-dir
```

You can customize coverage behavior in your `lupa.config.ts` configuration file. Note that declaring configuration options alone does not enable coverage collection (to avoid unexpected performance overhead). You must explicitly enable it via `enabled: true` in your config, or run tests with `--coverage` from the CLI:

```typescript
export default defineConfig({
  files: ['tests/**/*.spec.ts'],
  coverage: {
    // Explicitly enable coverage collection (defaults to false)
    enabled: true,

    // Array of glob patterns to include in coverage reports.
    // Specifying this will automatically include all matched files (even untested ones).
    include: ['src/**/*.ts'],

    // Array of glob patterns to exclude from coverage reports
    exclude: ['src/**/*.spec.ts', 'src/types.ts'],

    // Only process files with these extensions
    extension: ['.ts', '.js'],

    // List of coverage reporters to generate simultaneously (default: ['text-summary', 'html'])
    reporters: ['text-summary', 'html'],

    // The output directory where the reports will be written
    reportsDirectory: './coverage',

    // Enforce coverage threshold gates. If unmet, the test run will fail.
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
  },
})
```

#### Supported Coverage Reporters

Lupa supports all standard Istanbul/c8 reporters:
* **`text-summary`** (default): Prints a compact coverage percentage summary to the console stdout.
* **`html`** (default): Generates an interactive, clickable HTML report to browse coverage per line.
* **`text`**: Prints a detailed, file-by-file coverage table to the console stdout.
* **`lcov`**: Generates standard LCOV coverage files (`lcov.info`) and an HTML interactive report.
* **`lcovonly`**: Generates only the `lcov.info` file.
* **`clover`**: Generates Clover XML coverage reports (useful for Jenkins/CI integrations).
* **`cobertura`**: Generates Cobertura XML coverage reports (useful for Azure DevOps/GitLab integrations).
* **`json`**: Generates detailed raw JSON coverage data.
* **`json-summary`**: Generates a compact JSON summary of coverage metrics.
* **`teamcity`**: Prints TeamCity-formatted service messages.
* **`none`**: Silent mode (produces no terminal or file output).

> [!NOTE]
> **Browser Support:** Native V8 JavaScript coverage collection is only supported on Chromium-based browsers. If you execute tests on Firefox or WebKit, Lupa will print a warning that coverage collection is skipped for those browsers and proceed with the test execution.

### 6. Discovering Tests

You can list all available test suites and tests without executing them. You can filter the listing to specific suites using positional arguments or the `--suites` option:

```bash
npx lupa list
npx lupa list "Unit Tests"
npx lupa list --suites "Unit Tests"
npx lupa list --format json
```

You can also list files only, or filter files and tests directly using the following options:

- **List resolved files only** (skips starting Vite/Playwright):
  ```bash
  npx lupa list --files-only
  ```
- **Filter files by path** (implies `--files-only`, supports multiple queries with OR logic):
  ```bash
  npx lupa list --search-files "auth" "profile"
  ```
- **Filter tests by title** (supports multiple queries with OR logic):
  ```bash
  npx lupa list --search-tests "should login" "should logout"
  ```

## AI Agent Integration (MCP)

Lupa features a standalone Model Context Protocol (MCP) server package that empowers AI agents inside your IDE (like Cline, Roo, or Cursor) to programmatically discover, filter, and run your test suites. 

To connect an agent to Lupa, add the following configuration to your IDE's MCP settings:

```json
{
  "mcpServers": {
    "lupa": {
      "command": "npx",
      "args": ["-y", "@pawel-up/lupa-mcp"]
    }
  }
}
```

Once connected, your AI assistant will be able to efficiently list the test tree without executing it, and intelligently isolate and run only the specific test suites or tags it needs to verify while writing or refactoring your code.

## Troubleshooting

- **Watch Mode Collisions:** You cannot run `npx lupa test` with both `--watch` and a parallel suite runner like `concurrently`. Multiple browser instances and Vite dev servers will conflict. Use parallelization strictly in headless CI environments.
- **Hanging Tests:** If a test is failing to exit or hanging indefinitely, ensure that any external asynchronous resources (like custom servers) instantiated in `setup()` hooks return a proper cleanup function (e.g., `return () => server.close()`). Lupa guarantees execution of teardown cleanups even when assertions fail.

## Contributing

Lupa is an open-source project and we would absolutely love your help making it the best browser testing framework available! 

If you have ideas, find bugs, or want to contribute new features (like reporters, assert plugins, or execution optimizations), please feel free to open an issue or submit a Pull Request.

## License

Apache-2.0
