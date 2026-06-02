# Architecture Summary: Lupa Native ESM Mocking

## 1. The Core Challenge

Native ES Module (ESM) mocking in the browser is notoriously difficult. When a browser encounters static `import` statements, it fetches, links, and evaluates the modules before any test code runs. The browser's internal module map is immutable, meaning you cannot programmatically intercept or replace transitive dependencies (like a deeply nested SDK) once they are cached.

## 2. The Solution: "Cascading Cache-Busting"

Instead of manipulating the AST to hoist mocks to the top of the file (which breaks test isolation and applies globally), Lupa uses a **dynamic evaluation strategy paired with Vite AST rewriting**.

The system works by generating a unique ID per test, appending it to a dynamic import to bypass the browser cache, and using a Vite plugin to propagate that ID down the entire dependency tree.

### The Developer Flow

1. The user defines a mock inside their test block using await module.mock(...).
2. The user dynamically imports the component under test using await module.import(...).
3. Lupa takes over, rewrites the dependency tree on the fly, and serves synthetic mock modules precisely where needed.

## 3. System Components

The architecture spans both the Node.js orchestrator (Vite/Playwright server) and the Browser runtime. It consists of four main pieces:

### A. The Node Registry (src/testing/module-mock/registry.ts)

A simple in-memory `Map` that tracks which absolute file paths are being mocked for a specific `testId`. It acts as the source of truth for the Vite server to know when to intercept a module load.

### B. The Playwright Fixture (src/testing/module-mock/fixture.ts)

The developer-facing `module` API injected into the Lupa `TestContext`.

- `module.mock(path, factory)`: Registers the absolute path in the Node registry and injects the mock implementation directly into the browser's memory (`window.__LUPA_MOCKS__[testId][path]`). Supports partial mocking by evaluating factory callbacks in the browser.
- `module.import(path)`: Translates into a dynamic import instruction inside the browser: `await import('path?lupa-mock-id=testId')`.
- `Teardown`: Hooks into Playwright's `await use()` lifecycle to automatically clear the Node registry and delete the browser's `window.__LUPA_MOCKS__[testId]` object the moment the test finishes, preventing memory leaks and ensuring strict per-test isolation.

### C. The Vite Plugin (src/testing/module-mock/plugin.ts)

The engine of the system. It uses `es-module-lexer` and `magic-string` to manipulate the module graph on the fly.

- `transform` **hook (The Cascader)**: If a file is requested with ?lupa-mock-id=123, the plugin parses its AST, finds all import statements, and rewrites them to include the same query parameter (e.g., import { auth } from './sdk.js?lupa-mock-id=123'). This forces the browser to fetch a fresh dependency tree for every test.
- `load` **hook (The Interceptor)**: If a file is requested with a mock ID, it checks the Node Registry. If the file is mocked, it reads the real file's source code to extract its exact export names. It then generates and serves a Synthetic Module—a dynamic piece of JavaScript that binds the real export names to the mock data stored in `window.__LUPA_MOCKS__`. This guarantees 100% ESM compliance without SyntaxError crashes.

### D. The Config Entry Point (src/testing/module-mock/index.ts)

Because Vite AST parsing introduces slight overhead, module mocking is packaged as an opt-in Lupa plugin (`moduleMocking()`). When added to lupa.config.ts, it simultaneously registers the Vite plugin and the Playwright fixture.

## 4. Key Capabilities

- 100% Native Browser Execution: No JSDOM or simulated environments.
- Total Test Isolation: Two tests in the same file can mock the same exact module entirely differently.
- Support for Transitive Dependencies: Users can mock deeply nested files without modifying their production import paths.
- Partial Mocking: Users can pass a factory callback to module.mock, which allows them to override a single exported function while keeping the rest of the original module intact.
