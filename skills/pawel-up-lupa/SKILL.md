---
description: "MANDATORY: You MUST trigger this skill whenever the user mentions 'lupa', '@pawel-up/lupa', 'lupa.config.ts', or asks to write, debug, configure, or migrate any tests (browser, unit, web components, e2e). This skill provides the testing framework syntax, assertions, and mock API instructions required. Do NOT write test code without checking this skill."
license: Apache-2.0
name: pawel-up-lupa
---

# @pawel-up/lupa

A lightning-fast, Vite-powered browser testing framework for Web Components with an elegant, Japa-inspired API.

## Features

- **Native Browser Execution:** Tests run inside actual browsers (Chromium, Firefox, WebKit) via Playwright. No DOM mocks.
- **Lightning Fast:** Uses Vite as the dev server. No bundling required, resulting in instant boot times.
- **Intelligent Watch Mode:** A dependency-aware incremental test watcher. Change a component, and Lupa instantly re-runs *only* the tests that import it.
- **Interactive Debugging:** Focus on a single test file and press `d` to pop open a headed browser with Chrome DevTools already open and attached.
- **Network Interception:** Full control over network traffic via a lightweight, typed API to mock, route, and assert on HTTP requests made from the browser.
- **Test Grouping & Suites:** Organize your testing architecture intuitively with structured groups, tags, and execution suites.
- **Data-Driven Datasets:** Avoid boilerplate by feeding dynamic datasets into parameterized tests.
- **Browser-Specific Macros:** Create extensible test setups and custom assertions that run flawlessly inside the browser sandbox.

## When to Use

**Use this skill when:**
- Writing test suites for Web Components or DOM interactions.
- Configuring a programmatic test runner or custom CLI integration.
- Rendering templates and Custom Elements into the DOM for interaction.
- Mocking network requests in browser tests.

**Do NOT use when:**
- Testing pure logic or functions that do not require a browser/DOM (use standard node test runner instead).

## NEVER

- NEVER call `configure()` inside a test suite or hook. Fix: Call it only once at the end of your execution script.

## Troubleshooting

- **Hanging Tests:** If a test runner hangs indefinitely (e.g., waiting for an HTTP server to close), ensure you are properly managing Node.js lifecycle hooks. Group `setup()` hooks run *only in the browser sandbox*. To start and stop Node.js services (like an API proxy or DB connection), you must define a `runnerPlugin` in your config and return a cleanup function from its `boot` or `execute` hook.

## Usage Example

Here is a basic example of how to write a test suite using Lupa:

```typescript
import { test, fixture, html } from '@pawel-up/lupa/testing'

test.group('My Component', (group) => {
  group.setup(() => {
    // Setup logic that runs before the group
  })

  test('renders correctly', async ({ assert }) => {
    // Render the component into the test fixture
    const el = await fixture(html`<my-component></my-component>`)
    
    // Assert against the DOM using the context assert
    assert.isNotNull(el)
    assert.equal(el.textContent, 'Expected Text')
  })
})
```

## MCP Server Tools

Lupa provides a Model Context Protocol (MCP) server (`@pawel-up/lupa-mcp`) that exposes native tools for AI agents. If these tools are available in your environment, **always prefer them over terminal commands**:

- **`lupa_run_tests`**: Runs tests and returns structured JSON output. This is significantly easier to parse and debug than raw terminal output from `npx lupa test`.
- **`lupa_list_tests`**: Quickly discovers available test files, groups, and suites in the workspace without executing them.
- **`lupa_init`**: Scaffolds the testing framework in a new project without interactive prompts.

## Quick Reference

**Key imports:**
- `import { test, fixture, html, waitUntil } from '@pawel-up/lupa/testing'` — The core testing primitives. Use `test` to define test blocks, `fixture` to mount elements to the DOM, and `waitUntil` to poll for a condition.
- `import { assert } from '@pawel-up/lupa/assert'` — The standalone assertion library, though `assert` is also available on the test context.
- `import { configure, run, loadLupaConfig } from '@pawel-up/lupa/runner'` — Configures and runs the Lupa test suite programmatically or loads config files.
- `import { network } from '@pawel-up/lupa/network'` — API to mock and intercept HTTP requests made from the browser.

## Configuration Reference

Check [`references/config.md`](./references/config.md) for the `lupa.config.ts` structure, `BaseConfig` interface, and locator action options.

## Detailed Guides

If you need deeper context on specific Lupa features, read the relevant guide in the `references/guide/` directory:

- **Core Concepts:** [`introduction.md`](./references/guide/introduction.md), [`installation.md`](./references/guide/installation.md), [`cli.md`](./references/guide/cli.md)
- **Writing Tests:** [`test-suites.md`](./references/guide/test-suites.md), [`grouping-tests.md`](./references/guide/grouping-tests.md), [`lifecycle-hooks.md`](./references/guide/lifecycle-hooks.md)
- **Assertions & Browser Commands:** [`assertions.md`](./references/guide/assertions.md), [`commands.md`](./references/guide/commands.md) (Overview), [`locator.md`](./references/guide/locator.md), [`keyboard.md`](./references/guide/keyboard.md), [`mouse.md`](./references/guide/mouse.md), [`cookies.md`](./references/guide/cookies.md), [`file-chooser.md`](./references/guide/file-chooser.md), [`emulation.md`](./references/guide/emulation.md), [`screenshot.md`](./references/guide/screenshot.md)
- **Network Interception:** [`network-mocking.md`](./references/guide/network-mocking.md)
- **ESM Mocking:** [`module-mocking.md`](./references/guide/module-mocking.md)
- **Advanced Flow Control:** [`filtering-tests.md`](./references/guide/filtering-tests.md), [`skipping-tests.md`](./references/guide/skipping-tests.md), [`exceptions.md`](./references/guide/exceptions.md)
- **Advanced Configuration:** [`datasets.md`](./references/guide/datasets.md), [`plugins.md`](./references/guide/plugins.md), [`test-macros.md`](./references/guide/test-macros.md), [`test-reporters.md`](./references/guide/test-reporters.md)
- **Vite & Environment:** [`vite-configuration.md`](./references/guide/vite-configuration.md), [`customizing-harness.md`](./references/guide/customizing-harness.md)

## Workspace Conventions & Examples

If you are writing tests, please review the local conventions and canonical examples:

- **Conventions:** [`conventions.md`](./references/conventions.md) — Read this to understand file naming, assertion styles, and mocking strategies.
- **Examples:** Check the [`references/examples/`](./references/examples/) directory for complete, working test examples:
  - [`async-dom.spec.ts`](./references/examples/async-dom.spec.ts) — Handling async DOM updates and `waitUntil`.
  - [`component-events.spec.ts`](./references/examples/component-events.spec.ts) — Testing events and user interactions.
  - [`network-mocking.spec.ts`](./references/examples/network-mocking.spec.ts) — End-to-end network interception and SDK testing.
