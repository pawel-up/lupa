# Lupa Parallel Execution Architecture Plan

This document outlines the architectural changes required to transition Lupa from a sequential, single-page test runner to a highly concurrent, multi-browser test execution framework.

## 1. Goals & Principles

- **Speed:** Drastically reduce test execution time by running test files in parallel.
- **API Ergonomics:** Preserve the elegant, Japa-inspired testing API (`test`, `test.group`, `test.macro`, etc.). Users should not need to rewrite their test files.
- **Isolation:** Each parallel worker will run in its own Playwright Page to guarantee isolation and full DOM API access.
- **Clean Telemetry:** Transition reporters from synchronous, stream-based renderers to asynchronous, buffered renderers to prevent interleaved CLI output.
- **Modularity:** Decompose the monolithic `runner/index.ts` into single-responsibility, independently testable class units (e.g., separating browser orchestration from the runner loop).

## 2. Opt-out Parallelism & Concurrency Control

Parallel execution will become the default mode for Lupa.

- **Configuration:** Add `parallel` (boolean) and `concurrency` (number or `'auto'`) to the Lupa configuration.
  ```typescript
  export interface Config {
    // ...
    parallel?: boolean; // Default: true
    concurrency?: number | 'auto'; // Default: 'auto' (e.g., os.cpus().length - 1)
  }
  ```
- **Opt-out:** Users can opt out by setting `parallel: false` or using a CLI flag `--no-parallel`. In this case, `concurrency` is strictly `1`.

## 3. Worker Pool & Sharding Strategy

Test execution will no longer feed all suites to a single `runner.html`. Instead, we will implement a Sharding & Pool mechanism.

### The Page Pool & Static Sharding
We will discard the idea of iframes or Web Workers (since Web Components and UI tests require access to the main thread's DOM APIs) and instead utilize **Playwright Pages**. To minimize communication overhead during the run, we will use **Static Sharding** upfront.

1. **Browser Initialization**: The `ServerManager` boots the requested Browser(s).
2. **Page Pool Creation**: The runner creates a pool of $N$ `Page` instances (where $N$ is the `concurrency` limit).
3. **Static Sharding**: A dedicated `TestPoolManager` gathers all test files from the `Planner` and statically divides them into $N$ roughly equal chunks.
4. **Execution**: The `TestPoolManager` assigns one complete chunk (e.g., 25 test files) to each `Page` in the pool at boot time. Each Page then sequentially evaluates and executes its entire assigned batch of files without needing to constantly ask the central pool for more work.

### Multi-Browser Support & Extensibility
This architecture natively unlocks the ability to test across multiple browsers simultaneously (e.g., Chromium, Firefox, WebKit).
- The pool manager will split the test files first across the requested **Browsers**, and then subdivide them into the **Pages** within those browsers.
- **Encapsulation:** Browser orchestration will be extracted from `runner/index.ts` into specialized classes (e.g., `BrowserManager`, `ChromiumDriver`, etc.). Each class will be responsible for starting its respective browser, managing its lifecycle, and collecting browser-specific metrics. This modularity accommodates the subtle API differences between Playwright browsers and makes the logic independently testable.

## 4. Telemetry, The `Tracker`, and Node-Side Emitters

The current telemetry system pipes raw browser events directly into the Node.js runner. With concurrency, this model becomes brittle.

### Dedicated Node-Side Emitter
We will introduce a dedicated Event Emitter specifically for the Node-side orchestrator.
- **Type Divergence:** The events emitted by the browser (e.g., `suite:start`, `test:end`) will diverge from the Node-side runner events (e.g., `runner:pool:start`, `runner:browser:finished`). We will create a clear type separation between `BrowserTelemetryEvents` and `NodeRunnerEvents` to prevent type pollution and clarify where an event originated.
- **Event Hydration:** The Node-side emitter will consume raw WebSocket telemetry, hydrate it (e.g., source-mapping stack traces), and re-emit it as a robust Node-side event.

### Changes to the Tracker
The current `Tracker` relies on singleton state (`#currentSuite`, `#currentGroup`) which assumes tests execute sequentially. This will break under concurrency.
- **Correlation IDs:** Every event payload sent from the browser to Node via the Vite WebSocket must include a unique `suiteId`, `groupId`, and `file`.
- **State Maps:** The `Tracker` will replace singletons with Maps tracking active executions per file/page.
  ```typescript
  #activeSuites: Map<string, FailureTreeSuiteNode> // Keyed by suiteId or file
  #activeGroups: Map<string, FailureTreeGroupNode> // Keyed by groupId
  ```

## 5. Reporter Architecture Changes

Reporters currently stream output immediately to the CLI (`console.log`), assuming exclusive ownership of the terminal. With parallel execution, this causes interleaved and scrambled text.

### Buffered Rendering & Multi-Browser Aggregation
Reporters will now operate in a **Buffered Mode**:
- Reporters will listen to `suite:start`, `test:start`, etc., and accumulate the results in memory.
- **Browser Aggregation & Failures:** When a test file is run across multiple browsers, reporters must buffer the results and wait until **all active browsers** have finished executing that specific test/group/suite.
  - If a test fails in *any* single browser, the test fails globally.
  - If a test fails in *multiple* browsers, the reporter must display the failure details separately for each browser, as the stack traces or reasons for failure (e.g., a Safari-specific DOM quirk vs a Chromium engine bug) may be completely different.
- When a `suite:end` or `file:end` event is safely aggregated across all target browsers, the reporter will flush the entire formatted block to the CLI at once. This ensures that a file's test results are printed contiguously, regardless of what other files were running concurrently.

### The CLI Interference Rule
To prevent multiple reporters from fighting for the standard output (e.g., a progress bar and a spec renderer running at once), reporters must explicitly declare their CLI usage.
- Add a `usesCLI: boolean` property to the `BaseReporter` interface.
- The `Runner` will enforce that **only one reporter with `usesCLI: true` can be activated per test run**. (E.g., You can output to `NdJSONReporter` and `DotReporter` simultaneously because NdJSON outputs to a file/stream, but you cannot use `DotReporter` and `SpecReporter` together on the TTY).

### Default Reporter & Global Progress
The default CLI reporter will shift from `spec` to a `progress` or `dot` style reporter.
- **Global Progress:** The runner must emit high-level progress events (e.g., `runner:progress { completed: 45, total: 300 }`) so that reporters can display a unified progress bar or dot matrix representing the total pool execution, rather than just isolated file streams.
- **Progress Accumulation:** Reporters will track the overall sum (`executed` vs. `total`) dynamically across all active pages.

### The Spec Reporter
The current `SpecReporter`'s legacy stream-based rendering is incompatible with parallel testing. It will either:
1. Be rewritten to use the new buffering strategy (flushing a tree of tests only when the suite ends).
2. Be phased out in favor of the progress reporter and a detailed failure summary at the end.

## 6. Preserving Test API Ergonomics

The most critical requirement is that test files remain unchanged.

```typescript
import { test } from '@pawel-up/lupa'

test('my component renders', async ({ assert }) => {
  // This must still work identically.
})
```

Because Japa's API uses global state to collect tests during file evaluation:
1. When a Playwright Page is assigned a chunk of test files, it will load the framework and evaluate **its batch of files sequentially**.
2. Because each chunk of files runs in complete isolation within its own Playwright Page, the global state inside that Page remains predictable. There is no cross-chunk state pollution because different parallel chunks are evaluated in entirely separate Browser Pages.

## 7. Decoupling `runner/index.ts`

Currently, `runner/index.ts` operates as a massive God-object handling CLI parsing, Vite initialization, Playwright booting, WebSocket routing, and test orchestration. This file will be aggressively decomposed into distinct, isolated logic units (similar to `@web/test-runner`).

- `ServerManager`: Handles Vite lifecycle and telemetry WebSocket.
- `BrowserManager`: An abstract orchestrator managing the lifecycle of `BrowserDriver` instances.
- `BrowserDriver`: Specific implementations for Chromium, Webkit, and Firefox handling process launching, Page assignment, and metric collection.
- `TestPoolManager`: A dedicated class responsible for taking the total list of test files and computing the static sharding/chunking, ensuring tests are evenly split across browsers and their respective Page instances.

By encapsulating these logic units into respective classes, they can be comprehensively unit tested in isolation.

## 8. WatchManager Redesign & CLI Integration

The current `WatchManager` acts as the primary CLI interface during watch mode. However, it is loosely coupled by passing callback functions (like `executeTests` and `shutdown`). With the introduction of multiple browsers and a test pool, the `WatchManager` requires tighter integration.

- **Event-Driven or Inversion of Control:** Instead of passing callbacks, the `WatchManager` will either be heavily event-driven (dispatching `watch:re-run` or `watch:focus` events) or it will consume the `Runner` / `ServerManager` instance directly via its constructor so it has explicit control over the orchestration lifecycle.
- **Multi-Page Awareness:** The `WatchManager` CLI must be aware of the multi-page/multi-browser state. For example, if a user focuses on a specific file, the `WatchManager` must instruct the `TestPoolManager` to clear the sharding queue, spin up a single Page, and execute only that focused file.
- **State Retention (Focus Mode):** When entering Focus Mode, the `Tracker` should retain the buffered results of all other non-focused tests. When a file is saved during Focus Mode, only the focused file runs. When exiting Focus Mode back to the general UI, the runner should **not** rerun all tests; it should immediately re-render the reporters using the newly updated focused test results merged with the retained buffer of the other tests.

## 9. Smart Re-runs & Module Graph Analysis

Currently, Lupa blindly reruns all test suites when any file in the workspace changes. This is inefficient, especially when changing a single test file.

- **Vite Dependency Graph:** We will tap into Vite's `ModuleGraph` API (which tracks how imports connect files) to perform smart invalidations.
- **Targeted Test Execution:** 
  - If a **test file** (`.spec.ts`) is modified, only that specific test file will be rerun by the `TestPoolManager`.
  - If a **source file** (`.ts`, `.js`, `.css`) is modified, the runner will traverse the Vite module graph to find exactly which test files import that source file (directly or indirectly) and will strictly re-queue only those affected test files.
- **Merged Reporting:** Just like Focus Mode, the `Tracker` will retain the previous run state of unaffected tests and merge it with the freshly executed results of the affected tests.
- **Simplified Partial UI:** When executing a smart re-run (or focus mode), the reporters can display a simplified "partial run" UI. Instead of trying to render the entire global state, the reporter can cleanly show the progress of *just the current task/chunk* being re-run, followed by a re-render of the overall global failure summary (since the legacy `spec` reporter will be deprecated, clearing the terminal and re-drawing a clean progress/summary block becomes a trivial and fast operation).

## 10. Build Tool Optimization Strategy

To fully realize the speed gains of parallel test sharding, we must address the server-side bottleneck. Vite's dev server incurs a waterfall overhead when dynamically loading unbundled test files.
- **Evaluation:** We will assess whether Vite can be sufficiently optimized for this use case (e.g., aggressive `optimizeDeps` for the UI library and Lupa framework internals).
- **Esbuild Alternative:** If Vite's module graph processing remains a bottleneck during parallel requests, we will strongly consider adopting a raw `esbuild` compilation pipeline specifically for test execution (similar to WTR), bypassing the Vite middleware stack entirely for pure speed. Note: Doing so would mean we'd have to build our own module graph dependency tracker for the "Smart Re-runs" feature, as we would lose Vite's `ModuleGraph`.

## Summary of Execution Flow
1. **Node**: Parse config (`parallel: true, concurrency: 4`).
2. **Node**: `Planner` finds 40 test files.
3. **Node**: `TestPoolManager` computes static sharding (4 chunks of 10 files per browser).
4. **Node**: Boot Vite Server via `ServerManager`.
5. **Node**: Boot Browsers via `BrowserManager`. For each browser, open up to 4 `Page` instances.
6. **Node**: `TestPoolManager` feeds Chunk 1 (10 files) to Page 1, Chunk 2 to Page 2, etc.
7. **Browser (Page 1)**: Sequentially imports its 10 files, evaluates tests, executes them, sends WebSocket telemetry.
8. **Node**: `Tracker` correlates WebSocket events using the file ID and Browser ID.
8. **Node**: `ProgressReporter` updates a single CLI progress bar based on total tests found vs. completed.
9. **Node**: All chunks complete across all browsers. Reporter prints final failure tree, breaking down failures by browser.
10. **Node**: `ServerManager` shuts down pool.
