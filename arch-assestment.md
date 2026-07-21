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

1. TestPoolManager is Too Complex

`test_pool_manager.ts` does too many jobs:

- Priority tier computation
- Round-robin sharding
- File path resolution
- Excluded file tracking
- Files count calculation

Suggestion: Split into:

- ShardingStrategy - Round-robin distribution logic
- PriorityPlanner - Tier computation
- TestPoolManager - Coordination only

1. Orchestrator is a God Object (504 lines)

`orchestrator.ts` manages:

- Browser lifecycle
- Server lifecycle
- Test execution
- CLI interactions
- Telemetry
- Plugin hooks
- Shutdown coordination
- Error handling

Suggestion: Extract:

- LifecycleManager - Boot/shutdown coordination
- TestExecutor - Wave execution logic (currently #runWaves)
- Keep Orchestrator as a thin coordinator

1. Implicit Global State

The browser-side test context relies on globals:

```ts
const activeTest = getActiveTest() // Implicit global state
```

This works but makes reasoning harder. Consider explicit context threading:

```ts
fixture(html`...`, { context: this }) // Explicit
```

1. ServerManager Does Too Much

`server_manager.ts` handles:

- Vite server creation
- Coverage instrumentation
- Plugin resolution
- WebSocket setup
- Warmup requests

Suggestion: Extract PluginResolver and CoverageIntegrator as separate concerns.

1. Error Handling is Inconsistent

Some places throw, others use `ExceptionsManager.notifyException()`:

```ts
// Inconsistent:
throw new Error('...')                          // Some places
this.exceptionsManager.notifyException(error)   // Other places
```

Suggestion: Standardize - always use ExceptionsManager for runtime errors, throw only for programmer errors.

1. No Retry Backoff Strategy

Test retries are simple counters:

```ts
retry(retries: number)
```

Suggestion: Add exponential backoff or delay between retries for flaky network tests.

1. Limited Parallelism Control

Concurrency is global (concurrency: 4). Some suites might benefit from serial execution while others run parallel.

Suggestion: Per-suite concurrency override:

```ts
{ name: 'e2e', concurrency: 1 }  // Serial
{ name: 'unit', concurrency: 8 } // Parallel
```

1. Telemetry Queue Has No Backpressure

Telemetry.handleLupaTelemetryEvent processes events immediately:

```ts
handleLupaTelemetryEvent = (data: any, client: any) => {
  this.#queue.push({ data, client, time: Date.now() })
}
```

If the browser emits events faster than Node.js can process them, the queue grows unbounded.

Suggestion: Add a max queue size and drop/warn on overflow.

1. No Test Result Caching for Watch Mode

When a file changes, all dependent tests re-run. Could cache results of unchanged tests to speed up feedback.

Suggestion: Store test result hashes and skip re-running tests whose dependencies haven't changed.

1. Module Mock Leaks Between Tests

The module-mock system requires manual cleanup. If a test throws before calling `restore()`, mocks persist.

Suggestion: Auto-register mocks with test cleanup hooks (like fixtures do).

---

## What is Bad ❌

1. Test Timeout Implementation is Fragile

Timeouts are managed via setTimeout with manual cleanup:

```ts
this.#activeRunner.resetTimeout(duration)
```

The resetTimeout logic is scattered and error-prone. If an exception occurs mid-test, the timeout might not clear, causing false failures.

**Problem**: Tests failing with "timeout" when they actually threw an exception first.

**Fix**: Use AbortController for cancellation:

```ts
const controller = new AbortController()
setTimeout(() => controller.abort(), timeout)
await testExecutor({ ...context, signal: controller.signal })
```

1. Shutdown Race Conditions

The shutdown sequence has multiple concurrent cleanups:

```ts
await Promise.all([
  this.browserManager?.close(),
  this.vite?.close(),
  this.serverManager?.coverageManager?.generateReport()
])
```

If coverageManager.generateReport() tries to extract coverage from an already-closed browser, it fails.

**Problem**: Failed to extract coverage errors in CI.

**Fix**: Sequential shutdown with explicit ordering:

```ts
// 1. Extract coverage first (browser still alive)
await this.browserManager.extractCoverage(...)
// 2. Close browser
await this.browserManager.close()
// 3. Generate report (no browser needed)
await this.serverManager.coverageManager.generateReport()
// 4. Close Vite
await this.vite?.close()
```

1. `runner.end()` is Not Idempotent in All Cases

Despite the #ended flag, there are race conditions:

```ts
if (this.#ended) return
this.#ended = true
await this.#emitter.emit('runner:end', { hasError: this.#failed })
```

If two promises call end() simultaneously, both pass the guard before setting the flag.

**Fix**: Use a promise cache:

```ts
#endPromise?: Promise<void>

async end() {
  if (this.#endPromise) return this.#endPromise
  this.#endPromise = this.#doEnd()
  return this.#endPromise
}
```

(Note: Recent commit a95c5e4 may have addressed this)

1. ExceptionsManager Silently Swallows Errors

`exceptionsManager.notifyException()` adds errors to a list but doesn't log them immediately:

```ts
notifyException(error: Error) {
  this.#errors.push(error)
}
```

**Problem**: Errors occur mid-test but aren't visible until report() is called at shutdown - debugging is painful.

**Fix**: Log immediately + store:

```ts
notifyException(error: Error) {
  console.error('[Lupa Internal Error]', error)
  this.#errors.push(error)
}
```

1. Browser Page Slots are Statically Allocated

BrowserManager creates concurrency pages upfront:

```ts
for (let i = 0; i < concurrency; i++) {
  pages.push(await context.newPage())
}
```

**Problem**: If a test suite has only 2 files but concurrency: 8, 6 browser pages sit idle, wasting memory.

**Fix**: Lazy page allocation - create pages as chunks arrive.

1. No Circuit Breaker for Playwright Failures

If Playwright fails to launch (e.g., Chrome not installed), the orchestrator retries indefinitely via the global timeout.

**Fix**: Fail-fast on browser launch errors:

```ts
try {
  await playwright.chromium.launch()
} catch (err) {
  throw new Error('Failed to launch browser. Is Playwright installed?')
}
```

1. Coverage Threshold Failures are Silent

The CoverageManager checks thresholds but doesn't surface failures clearly:

```ts
if (coverage < threshold) {
  // What happens here?
}
```

**Fix**: Mark tests as failed and print a summary:

```sh
❌ Coverage threshold not met:
    Lines: 65% (expected 80%)
    Branches: 55% (expected 70%)
```

1. Plugin Teardown Errors are Swallowed

```ts
for (const teardown of this.#pluginTeardowns) {
  try {
    await teardown()
  } catch (error) {
    debug('error executing plugin teardown hook: %O', error)
    // Error swallowed - no propagation
  }
}
```

Problem: Plugin cleanup failures (e.g., test database not shutting down) are invisible to users.

**Fix**: Collect errors and report them with the summary.

1. No Retry Jitter

Test retries happen immediately:

```ts
for (let attempt = 0; attempt <= retries; attempt++) {
  await test.exec()
}
```

**Problem**: Flaky network tests fail deterministically if the network issue persists for <1s.

**Fix**: Add jitter:

```ts
await delay(Math.random() *1000* attempt)
```

1. Watch Mode File Filtering is Too Eager

The server watch config excludes many directories:

```ts
ignored: [
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  // ...15+ entries
]
```

**Problem**: If a user has a custom directory structure (e.g., packages/core), it might be incorrectly ignored.

**Fix**: Make the ignore list configurable via lupa.config.ts.

---
Architecture Diagram

```plain
┌─────────────────────────────────────────────────────────────┐
│                        Orchestrator                         │
│  (Central Coordinator - Boot, Execute, Shutdown)            │
└─────┬───────────────┬──────────────┬─────────────┬──────────┘
      │               │              │             │
      ▼               ▼              ▼             ▼
┌───────────┐  ┌─────────────┐ ┌──────────┐ ┌──────────────┐
│ Browser   │  │   Server    │ │TestPool  │ │ Exceptions   │
│ Manager   │  │  Manager    │ │ Manager  │ │  Manager     │
│(Playwright│  │   (Vite)    │ │(Sharding)│ │(Error Track) │
└─────┬─────┘  └──────┬──────┘ └────┬─────┘ └──────────────┘
      │               │             │
      │               │             │
      ▼               ▼             ▼
┌──────────────────────────────────────────┐
│         Browser Context (Harness)        │
│  ┌─────────┐  ┌────────┐  ┌──────────┐   │
│  │WebRunner│→ │ Suite  │→ │  Group   │   │
│  └─────────┘  └────┬───┘  └────┬─────┘   │
│                    │            │        │
│                    ▼            ▼        │
│               ┌────────────────────┐     │
│               │       Test         │     │
│               │  (with Context)    │     │
│               └─────────┬──────────┘     │
│                         │                │
│       ┌─────────────────┼─────────────┐  │
│       ▼                 ▼             ▼  │
│  ┌────────┐      ┌─────────┐   ┌───────┐ │
│  │Fixture │      │ Assert  │   │Network│ │
│  │(DOM)   │      │(Chai++) │   │ Mock  │ │
│  └────────┘      └─────────┘   └───────┘ │
└──────────────────────────────────────────┘
          │
          │ (WebSocket Telemetry)
          ▼
    ┌──────────┐
    │ Reporter │
    │(Progress)│
    └──────────┘
```

---

## Recommendations

### High Priority

1. Fix shutdown race condition (coverage extraction before browser close)
2. Make runner.end() truly idempotent (promise caching pattern)
3. Surface plugin teardown errors (don't swallow)
4. Add circuit breaker for Playwright launch failures
5. Log exceptions immediately in ExceptionsManager

### Medium Priority

1. Split Orchestrator (extract LifecycleManager, TestExecutor)
2. Refactor TestPoolManager (separate sharding, planning, tracking)
3. Add retry backoff/jitter for flaky tests
4. Add telemetry backpressure (max queue size)
5. Make watch ignore list configurable

### Nice to Have

1. Lazy browser page allocation
2. Per-suite concurrency control
3. Test result caching for watch mode
4. Explicit context threading (vs global state)
5. Auto-cleanup for module mocks

---

## Verdict

### Overall Architecture: 8/10

Lupa is a well-architected framework with clear separations, excellent DX, and smart technical choices (Vite, Playwright, WebSocket telemetry, V8 coverage). The core abstractions (Orchestrator, TestPoolManager, WebRunner, NetworkInterceptor) are solid.

The main issues are:

- God objects (Orchestrator, ServerManager, TestPoolManager could be decomposed)
- Shutdown sequencing (race conditions in cleanup)
- Error visibility (swallowed exceptions, silent plugin failures)
- Edge case brittleness (timeout handling, idempotency gaps)

These are fixable without major refactoring. The foundation is strong - this is a framework with staying power. With the improvements above, it could rival @web/test-runner while offering superior DX.
