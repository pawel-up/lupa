# Lupa Testing Framework - Architecture Analysis

## Overview

Lupa is a Vite-powered browser testing framework for Web Components with ~20,000 lines of TypeScript code across 89 files. It bridges Node.js orchestration with real browser execution via Playwright, drawing heavy inspiration from Japa's elegant API design.

---

## What Works Well ✅

1. Clear Separation of Concerns

The architecture has excellent domain separation:

- /runner - Node.js orchestration (Vite, Playwright, CLI, coverage)
- /testing - Browser-side test execution (Test, Group, Suite, fixtures)
- /network - Network interception and mocking
- /assert - Assertion library with DOM/accessibility extensions
- /module-mock - Module mocking via Vite plugin

This makes the codebase highly navigable and maintainable.

1. Orchestrator as Central Control Point

The Orchestrator class (504 lines) is the beating heart:

- Manages entire lifecycle: boot → execute → shutdown
- Coordinates BrowserManager, ServerManager, TestPoolManager, ExceptionsManager
- Handles watch mode, CLI interactions, telemetry
- Uses proper idempotent shutdown with promise caching (#shutdownPromise)
- Excellent error boundary with ExceptionsManager

This is exactly what a complex system needs - one source of truth for lifecycle management.

1. Priority-Based Test Execution (TestPoolManager)

The TestPoolManager is brilliantly designed:

- Tiered execution: Suites have priorities, executed highest-first
- Wave-based parallelism: Tests run in "waves" by priority tier
- Round-robin distribution: Files sharded across concurrency slots efficiently
- Excludable suites: excludeFromReporting enables benchmark/perf tests without polluting main reports

This allows advanced use cases like:

```ts
// Run critical tests first, benchmarks last (no reporter spam)
{ name: 'unit', priority: 100 }
{ name: 'benchmarks', priority: 0, excludeFromReporting: true }
```

1. Macroable Pattern for Extensibility

Test/Group/Suite/WebRunner extend @poppinss/macroable:

```ts
export class Test extends Macroable {
  // Users can add custom methods at runtime
}
```

This is a smart move for plugin authors - they can extend the DSL without forking.

1. Fixture Auto-Cleanup

The `fixture()` function automatically registers DOM cleanup:

```ts
activeTest?.cleanup(() => container.remove())
```

This prevents memory leaks and flaky tests from leftover DOM - a common pain point in browser testing.

1. Network Mocking with Polling Assertions

The `NetworkAssert` class provides polling assertions like `calledOnce()`:

```ts
await mock.assert.calledOnce() // Polls until request settles
const req = mock.lastRequest()  // Safe synchronous read
```

This prevents race conditions without manual `waitFor()` - excellent DX.

1. Coverage via V8 Inspector (Not Istanbul)

Using Playwright's native V8 coverage (`CoverageManager`) instead of build-time Istanbul instrumentation is much faster and avoids source map hell.

1. WebSocket Telemetry (not Polling)

The Telemetry class receives test results via Vite WebSocket:

```ts
this.#vite.ws.on('lupa:telemetry', this.#orchestrator.telemetry.handleLupaTelemetryEvent)
```

This is far superior to HTTP polling - events arrive immediately, no latency.

1. Watch Mode with Dependency Tracking

Leveraging Vite's module graph for incremental test runs:

> "Change a component, and Lupa instantly re-runs only the tests that import it."

This is killer DX - most browser test runners re-run everything.

1. Japa-Inspired API

The declarative API is gorgeous:

```ts
test.group('Button', () => {
  test('renders text', async ({ assert }) => {
    const el = await fixture(html`<button>Click</button>`)
    assert.include(el.textContent, 'Click')
  })
})
```

Familiar to Node.js developers, minimal boilerplate.

---

## What Can Be Improved 🟡

The following issues are prioritized by technical urgency based on their impact on runner correctness, developer experience, and architectural maintainability. Invalid claims (such as alleged module mock memory leaks or incorrect telemetry queue code) have been removed.

### High Urgency (Correctness & Architectural Foundation)

1. **Implicit Global State in Browser Test Execution** (Done)

   The browser-side test context relies on module-scoped global variables (`activeTest`, `activeGroup`, `activeSuite`, `activeFile` in [api.ts](file:///home/pawel/workspace/pawel-up/lupa/src/testing/api.ts#L48-L70)):

   ```ts
   const activeTest = getActiveTest() // Implicit global lookup in fixture()
   ```

   This reliance on global state introduces risks of state bleeding and race conditions when async tasks interleave.
   * **Suggestion**: Thread test context explicitly or utilize `AsyncLocalStorage` for browser context isolation.

2. **Orchestrator is a God Object** (Done)

   [orchestrator.ts](file:///home/pawel/workspace/pawel-up/lupa/src/runner/orchestrator.ts#L27-L506) (507 lines) directly manages every framework lifecycle:
   - Browser and Vite server lifecycles
   - Wave-based test execution (`#runWaves`)
   - CLI interaction & event buffering
   - Telemetry processing
   - Plugin hooks (`boot`, `execute`, `shutdown`)
   - Process exit & shutdown routines

   * **Suggestion**: Extract `LifecycleManager` (boot/shutdown coordination) and `TestExecutor` (wave execution) to make `Orchestrator` a thin coordinator.

3. **Inconsistent Error Handling**

   Error handling mixes raw `throw` statements, `process.exit()`, and `ExceptionsManager.notifyException()`:

   ```ts
   // Inconsistent pattern across runner and server manager:
   throw new Error('...')                          // Thrown directly in some modules
   this.exceptionsManager.notifyException(error)   // Buffered in other modules
   ```

   Direct `throw`s bypass the exception buffer and can lead to unhandled promise rejections or truncated error output before reporter summaries complete.
   * **Suggestion**: Standardize runtime error reporting through `ExceptionsManager` and reserve `throw` exclusively for programmer contract violations.

---

### Medium Urgency (Feature Completeness & DX)

4. **Limited Parallelism Control**

   Concurrency is strictly global (`concurrency: 4`). Individual suites cannot override execution parallelism:

   * **Suggestion**: Allow per-suite concurrency overrides in `TestSuite` definitions:
     ```ts
     { name: 'e2e', concurrency: 1 }  // Serial execution for stateful tests
     { name: 'unit', concurrency: 8 } // Parallel execution for unit tests
     ```

5. **No Configurable Retry Backoff Strategy**

   [runner.ts](file:///home/pawel/workspace/pawel-up/lupa/src/testing/test/runner.ts#L434-L440) passes a fixed `{ factor: 1 }` to `retry()`, causing a static 1-second delay between attempts without exponential backoff or custom delay options.

   * **Suggestion**: Add configurable backoff strategies (e.g. exponential backoff or custom delay callbacks) to `test.retry()`.

6. **No Test Result Caching for Watch Mode**

   When a file changes in watch mode, all dependent test files re-run via Vite module graph invalidation, but previous test outcomes are not cached.

   * **Suggestion**: Cache test result hashes to skip re-executing unchanged suites and provide instant feedback during watch runs.

---

### Low Urgency (Code Cleanliness & Refactoring)

7. **ServerManager Does Too Much**

   [server_manager.ts](file:///home/pawel/workspace/pawel-up/lupa/src/runner/server_manager.ts#L39-L233) handles Vite server instantiation, plugin specifier URL resolution, coverage instrumentation, WSS telemetry attachment, and URL warmup requests.

   * **Suggestion**: Extract `PluginResolver` and `CoverageIntegrator` into separate helper classes to simplify Vite configuration assembly.

8. **TestPoolManager Monolithic Partitioning**

   [test_pool_manager.ts](file:///home/pawel/workspace/pawel-up/lupa/src/runner/test_pool_manager.ts#L49-L288) combines priority tier grouping, round-robin sharding, excluded file filtering, and path resolution in a single class.

   * **Suggestion**: Extract `ShardingStrategy` and `PriorityPlanner` to enable isolated unit testing of sharding algorithms.
