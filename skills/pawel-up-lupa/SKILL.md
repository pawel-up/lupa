---
description: "A lightning-fast, Vite-powered browser testing framework for Web Components with an elegant, Japa-inspired API. Use when: Building a programmatic test runner or custom CLI integration.. Also: testing, web-components, browser-runner, vite, playwright, japa, dom, test-runner, shadow-dom, lit-html, browser-testing, component-testing."
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
- Building a programmatic test runner or custom CLI integration. → use `configure`
- You need to programmatically load and parse the Lupa configuration from a file. → use `loadLupaConfig`
- Rendering templates and Custom Elements into the DOM for interaction → use `fixture`

**Do NOT use when:**
- You are already inside a running test or suite. (`configure`)
- Testing pure logic or functions that do not require a DOM (`fixture`)

API surface: 20 functions, 13 classes, 110 types, 10 constants

## NEVER

- NEVER call this inside a test suite or hook. Fix: Call it only once at the end of your execution script.

## Troubleshooting

- **Watch Mode Collisions:** You cannot run `npx lupa test` with both `--watch` and a parallel suite runner like `concurrently`. Multiple browser instances and Vite dev servers will conflict. Use parallelization strictly in headless CI environments.
- **Hanging Tests:** If a test is failing to exit or hanging indefinitely, ensure that any external asynchronous resources (like custom servers) instantiated in `setup()` hooks return a proper cleanup function (e.g., `return () => server.close()`). Lupa guarantees execution of teardown cleanups even when assertions fail.

## Configuration

25 configuration interfaces — see references/config.md for details.

## Quick Reference

**Key functions:** `assertIsAccessible` (Asserts that a given DOM element or NodeList has no accessibility violations
according to axe-core), `configure` (Configure the Lupa test runner), `run` (Run the test suite), `loadLupaConfig` (Loads the Lupa configuration from a local file (e), `waitUntil` (Polls the condition function until it returns true or the timeout is reached), `fixture` (Renders a HTML string or a Lit template into a dedicated fixture container and mounts it to the DOM)

*153 exports total — see references/ for full API.*

## References

Load these on demand — do NOT read all at once:

- When calling any function → read `references/functions.md` for full signatures, parameters, and return types
- When using a class → browse `references/classes/` for grouped indexes, properties, methods, and inheritance
- When defining typed variables or function parameters → read `references/types.md`
- When using exported constants → read `references/variables.md`
- When configuring options → read `references/config.md` for all settings and defaults

## Links

- [Repository](https://github.com/pawel-up/lupa)
- Author: Pawel Uchida-Psztyc