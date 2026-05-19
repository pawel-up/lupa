# Test Run Flow

This document describes the exact flow of a test run in Lupa — from the CLI invocation to `process.exit`. It covers how each component is created, what events are emitted, and how data moves between Node.js and the browser.

---

## ASCII Diagram

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CLI / Programmatic entry                                                       │
│                                                                                 │
│  run()                         runProgrammatic(reporter, options?)              │
│   └─ SIGINT/SIGTERM handlers    └─ returns Promise<exitCode>                    │
└────────────────────────┬────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────┐
│  PHASE 1 — PLANNING                    │
│                                        │
│  Planner.plan()                        │
│  ┌──────────────────────────────────┐  │
│  │ 1. Activate reporters            │  │
│  │ 2. Collect test files (globs /   │  │
│  │    functions)                    │  │
│  │ 3. Apply --files CLI filter      │  │
│  │ 4. Build PlannedTestSuite[]      │  │
│  │ 5. Extract refinerFilters        │  │
│  │    (tags / tests / groups)       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  returns: config, reporters,           │
│           suites, refinerFilters       │
└────────────────────────┬───────────────┘
                         │
                         ▼
┌────────────────────────────────────────┐
│  new Orchestrator(config, cliArgs,     │
│                  reporters, suites,    │
│                  refinerFilters)       │
└────────────────────────┬───────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2 — BOOT  (orchestrator.boot())                                         │
│                                                                                │
│  ┌─────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐ │
│  │  ExceptionsManager  │   │  TestPoolManager     │   │  ServerManager       │ │
│  │  .monitor()         │   │                      │   │                      │ │
│  │                     │   │  concurrency:        │   │  Starts Vite dev     │ │
│  │  Hooks:             │   │   'auto' -> cpus-1   │   │  server on port 0    │ │
│  │  - uncaughtException│   │   N -> N             │   │                      │ │
│  │  - unhandledRejection   │                      │   │  Registers Vite WS   │ │
│  └─────────────────────┘   │  Divides files into  │   │  handler:            │ │
│                            │  chunks, one per     │   │  'lupa:telemetry'    │ │
│                            │  browser x page:     │   │  -> onTelemetry()    │ │
│                            │                      │   │                      │ │
│                            │  chromium-0 [f1..f5] │   │  Injects Vite plugin │ │
│                            │  chromium-1 [f6..f10]│   │  lupaHarnessPlugin   │ │
│                            │  firefox-0  [f1..f5] │   │  (serves runner.html)│ │
│                            │  ...                 │   │                      │ │
│                            └──────────────────────┘   │  Returns serverUrl   │ │
│                                                       └──────────────────────┘ │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  BrowserManager.boot(testPoolManager, onRunnerEnd)                       │  │
│  │                                                                          │  │
│  │  For each browserName (chromium / firefox / webkit):                     │  │
│  │    Launch playwright browser                                             │  │
│  │    For each chunk assigned to that browser:                              │  │
│  │      newPage()                                                           │  │
│  │      Wire BrowserLogs (console / errors -> browserEmitter)               │  │
│  │      Wire CommandsHandler (RPC from test code -> Node)                   │  │
│  │      Expose window.__lupa_runner_end__()                                 │  │
│  │      When all pages call __lupa_runner_end__ -> onRunnerEnd()            │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3 — EXECUTE  (orchestrator.executeTests())                               │
│                                                                                 │
│  1. Create fresh Emitter + Runner for this cycle                                │
│  2. Register reporters with runner                                              │
│  3. Apply refinerFilters (tags / test names / groups) -> runner.refiner         │
│  4. runner.start()  --> emits 'runner:start'                                    │
│  5. Set 120 s global safety timeout                                             │
│  6. browserManager.goto(serverUrl)                                              │
│     Navigate every page to:                                                     │
│       /__lupa__/runner.html?chunkId=<id>                                        │
└────────────────────────┬────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┴──────────────────────┐
         │ (parallel, one lane per browser page) │
         ▼                                       ▼
┌─────────────────────────────┐       ┌─────────────────────────────────────────┐
│  BROWSER (each page)        │       │  NODE — telemetry path                  │
│                             │  WS   │                                         │
│  lupaHarnessPlugin serves   │       │  ServerManager receives                 │
│  runner.html which:         │       │  'lupa:telemetry' WS events             │
│                             │       │  -> deserialize Errors (source-map)     │
│  1. Sets window.__lupa__    │       │  -> orchestrator.onTelemetry()          │
│     (suites, config)        │       │  -> activeNodeEmitter.emit(event, data) │
│                             │       │                                         │
│  2. boot() harness:         │       │  Runner listens on emitter:             │
│     a. Start Browser        │       │  - runner:start  -> reporters.start     │
│        ExceptionsManager    │       │  - suite:start   -> reporters           │
│     b. Load test plugins    │       │  - group:start   -> reporters           │
│     c. For each suite:      │       │  - test:start    -> reporters           │
│        - import test files  │  -->  │  - test:end      -> reporters           │
│          (catches errors    │       │                   -> Tracker.aggregates │
│          -> import_error)   │       │  - group:end     -> reporters           │
│        - add suite to       │       │  - suite:end     -> reporters           │
│          WebRunner          │       │  - runner:end    -> reporters.end       │
│                             │       │                                         │
│  3. webRunner.start()       │       │  Tracker builds:                        │
│     emits 'runner:start'    │       │  - aggregates (total/pass/fail/skip)    │
│                             │       │  - failureTree (suite->group->test)     │
│  4. webRunner.exec():       │       │  - importErrors                         │
│     for each Suite:         │       └─────────────────────────────────────────┘
│       suite.exec():         │
│         SuiteRunner.run()   │
│         ┌──────────────┐    │
│         │ suite:start  │--> │ WS
│         │ setup hooks  │    │
│         │ for each     │    │
│         │ group/test:  │    │
│         │  group:start │--> │ WS
│         │  for each    │    │
│         │  test:       │    │
│         │   test:start │--> │ WS
│         │   run cb     │    │
│         │   (retry)    │    │
│         │   test:end   │--> │ WS
│         │  group:end   │--> │ WS
│         │ teardown hks │    │
│         │ suite:end    │--> │ WS
│         └──────────────┘    │
│                             │
│  5. webRunner.end()         │
│     emits 'runner:end'  --> │ WS
│                             │
│  6. Wait 50 ms              │
│  7. window.__lupa_runner_   │
│     end__()  -------------> │ Node callback (Playwright exposeFunction)
└─────────────────────────────┘
                         │
         (all pages have called __lupa_runner_end__)
                         │
                         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4 — SHUTDOWN  (orchestrator.shutdown(exitCode))                         │
│                                                                                │
│  1. Clear global timeout                                                       │
│  2. exceptionsManager.report()  -> print buffered uncaught errors              │
│  3. Close debug browser (if open)                                              │
│  4. coverageManager.extract()   -> pull V8/Istanbul data from pages            │
│  5. browserManager.close()      -> close all Playwright pages + browsers       │
│  6. serverManager.close()       -> stop Vite dev server                        │
│  7. If any exceptions -> exitCode = 1                                          │
│  8. process.exit(exitCode)  — or return exitCode for programmatic API          │
└────────────────────────────────────────────────────────────────────────────────┘


===========================================================
  WATCH MODE (when config.watchMode === true)
===========================================================

  After orchestrator.boot(), Cli.start() is called once.

  Cli reacts to:

  ┌──────────────────────────────────────────┐
  │  Vite watcher 'change' event             │
  │  -> BFS through Vite ModuleGraph         │
  │  -> find affected test files             │
  │  -> update config.filters.files          │
  │  -> orchestrator.executeTests()  (re-run)│
  │  -> restore original filter              │
  └──────────────────────────────────────────┘

  ┌──────────────────────────────────────────┐
  │  Keyboard bindings (TTY)                 │
  │  Enter  -> re-run all tests              │
  │  f      -> focus on file (prompt)        │
  │  Esc    -> clear focus                   │
  │  d      -> open debug browser            │
  │  q      -> shutdown(0)                   │
  └──────────────────────────────────────────┘

  Each executeTests() cycle creates a fresh Emitter + Runner.
  The previous cycle's reporters receive 'runner:end' before
  the new cycle starts. Watch mode uses a filtered emitter
  that buffers events so focus mode can replay them later.
```

---

## Components

### `src/runner/index.ts` — Entry point

Exports three public functions:

| Function | Purpose |
| --- | --- |
| `defineConfig(config)` | Identity helper for TypeScript autocomplete |
| `run()` | CLI entry — wires SIGINT/SIGTERM, calls `Planner` then `Orchestrator`, exits via `process.exit` |
| `runProgrammatic(reporter, options?)` | Headless API — same flow, returns `Promise<exitCode>` instead of calling `process.exit` |

`run()` is the canonical path. It owns signal registration and delegates everything else.

---

### `src/runner/planner.ts` — Planner

Translates the user's config into a concrete execution plan before anything is booted.

**Inputs:** `NormalizedConfig`

**Outputs:**

- `reporters` — instantiated reporter objects
- `suites` — `PlannedTestSuite[]`, each with resolved `filesURLs`
- `refinerFilters` — `{ layer: 'tags'|'tests'|'groups', filters: string[] }[]`

**Responsibilities:**

- Resolve reporter names to reporter instances (validates no two CLI reporters)
- Collect test files from globs or callback functions
- Apply `--files` CLI filter
- Build one `PlannedTestSuite` per configured suite (or a single "default" suite when `config.files` is used)
- Extract tag / test name / group filters from CLI args

---

### `src/runner/config_manager.ts` — ConfigManager

Merges the three configuration layers in priority order (highest first):

1. CLI flags (`--tags`, `--files`, `--tests`, `--timeout`, `--reporters`, …)
2. User config file (`lupa.config.ts`)
3. Built-in defaults (timeout 2000 ms, retries 0, `dot` reporter in CI, `progress` in TTY)

Called once during startup; the result is a frozen `NormalizedConfig` shared by all components.

---

### `src/runner/orchestrator.ts` — Orchestrator

The central lifecycle manager. Owns the three long-lived sub-systems and coordinates every test cycle.

**Key properties:**

| Property | Type | Role |
| --- | --- | --- |
| `exceptionsManager` | `ExceptionsManager` | Captures unhandled Node.js errors |
| `testPoolManager` | `TestPoolManager` | Knows how files are chunked |
| `serverManager` | `ServerManager` | Owns the Vite dev server |
| `browserManager` | `BrowserManager` | Owns Playwright browser instances |
| `cli` | `Cli` | Watch-mode interactive interface |
| `activeNodeEmitter` | `Emitter` | Per-cycle event bus (Node side) |
| `browserEmitter` | `Emitter` | Persistent emitter for browser log events |

**Lifecycle methods:**

| Method | When called | What it does |
| --- | --- | --- |
| `boot()` | Once after construction | Creates and starts all sub-systems |
| `executeTests()` | Once per test cycle | Creates a fresh `Runner`, navigates browsers |
| `shutdown(exitCode)` | On completion or error | Drains, closes, then exits |

---

### `src/runner/test_pool_manager.ts` — TestPoolManager

Computes the static sharding of test files before any browser is opened.

**Algorithm:**

1. Determine `actualConcurrency`: `'auto'` → `os.cpus() - 1`, numeric → use directly, else `1`
2. Cap concurrency at the number of files (no idle pages)
3. For each browser name, create `actualConcurrency` chunks
4. Distribute files round-robin across chunks within each browser
5. Group files by suite within each chunk

Each chunk gets an ID like `chromium-0`, `firefox-1`, etc. That ID is passed to the browser as a query parameter so the harness knows which files to load.

---

### `src/runner/server_manager.ts` — ServerManager

Wraps the Vite dev server and owns the WebSocket telemetry channel.

**Boot sequence:**

1. Resolve test plugin paths
2. Create Vite config (root = cwd, port 0, `lupaHarnessPlugin`)
3. Register WebSocket handler for `lupa:telemetry` messages
4. Start Vite, capture the assigned port
5. Return `serverUrl`

**Telemetry path:**
Browser → `vite.ws.send('lupa:telemetry', payload)` → `ServerManager` → deserialize (source-map stacks) → `onTelemetry(eventName, data)` → `Orchestrator` → `activeNodeEmitter.emit(event, data)`

Special events handled before forwarding:

- `uncaught:exception` → `exceptionsManager.handleBrowserException()`
- `runner:import_error` → forwarded as-is
- `runner:pinned_tests` → forwarded as-is

---

### `src/runner/browser_manager.ts` — BrowserManager

Manages Playwright browser processes and their pages.

**Boot sequence (per browser):**

1. `playwright[browserName].launch()`
2. For each chunk: `browser.newPage()`
3. Wire `BrowserLogs` — forwards console/error events to `browserEmitter`
4. Wire `CommandsHandler` — allows test code to call back into Node via `page.exposeFunction`
5. `page.exposeFunction('__lupa_runner_end__', callback)`

**`goto(urlBase)`:** Navigates all pages simultaneously to `/__lupa__/runner.html?chunkId=<id>`. This is what triggers test execution.

---

### `src/runner/runner.ts` — Runner (Node side)

Coordinates reporters for a single test cycle.

**Construction:** Takes an `Emitter` and `NormalizedConfig`.

**`start()`:**

1. Creates a `Tracker`
2. Wires the `Tracker` to listen to all runner events
3. Calls each reporter's handler function (passes `runner`, `emitter`, `config`)
4. Emits `runner:start`

**`end()`:** Emits `runner:end` with `hasError` flag.

**`getSummary()`:** Returns the `RunnerSummary` built by the `Tracker` (aggregates + failure tree).

Enforces the "one CLI reporter" rule: throws if a second reporter with `usesCLI: true` is registered.

---

### `src/runner/tracker.ts` — Tracker

Stateful aggregator. Consumes runner events and builds the data reporters use at the end.

**State:**

| Field | Description |
| --- | --- |
| `activeSuites` | `Map<browserId:file:suiteName, FailureTreeSuiteNode>` |
| `activeGroups` | `Map<browserId:file:groupTitle, FailureTreeGroupNode>` |
| `aggregates` | `{total, failed, passed, skipped, todo, regression}` |
| `failureTree` | `FailureTreeSuiteNode[]` — only suites/groups/tests that failed |
| `importErrors` | `{file, error}[]` |
| `duration` | ms, measured from `runner:start` to `runner:end` |

Concurrency-safe because every event payload carries `browserId`, `file`, and suite/group identity, so parallel browser pages never collide in the maps.

---

### `src/runner/exceptions_manager.ts` — ExceptionsManager

Captures errors that escape the test runner itself.

**Sources:**

- `process.uncaughtException`
- `process.unhandledRejection`
- Browser-side uncaught errors forwarded by `ServerManager`
- Manual calls from `Orchestrator.catch`

**Buffering:** During active test execution errors are buffered silently. `report()` (called in `shutdown`) prints them all and transitions state so future errors print immediately.

---

### `src/runner/cli.ts` — Cli

Provides the interactive watch-mode interface on TTY.

**File watching:** Subscribes to Vite's module-graph watcher. When a source file changes it performs a BFS through the Vite `ModuleGraph` to find every test file that imports the changed file (directly or transitively), then triggers a targeted re-run of only those files.

**Keyboard bindings (raw TTY mode):**

| Key | Action |
| --- | --- |
| Enter | Re-run all tests |
| `f` | Prompt: pick a file to focus on |
| Esc | Clear focus |
| `d` | Open a headed debug browser with DevTools |
| `q` | `orchestrator.shutdown(0)` |

**Filtered emitter:** In watch mode `Cli` wraps `activeNodeEmitter` in a filtered emitter that buffers all events. When focus is active only events for the focused file pass through to reporters. When focus is cleared the buffer is replayed.

---

### `src/runner/plugins/harness.ts` — lupaHarnessPlugin (Vite plugin)

A Vite plugin that serves the runner HTML page at `/__lupa__/runner.html`.

**Per request:**

1. Parse `chunkId` from query string
2. Look up the `TestChunk` in `TestPoolManager`
3. Build `window.__lupa__` config object (suites, file URLs, test plugin paths, runner config)
4. Apply watch-mode file filters if active
5. Render HTML: injects the config script and a `<script type="module">` that imports `src/testing/harness.ts`

---

### `src/testing/harness.ts` — Browser harness bootstrap

The first JavaScript that runs inside each Playwright page.

**`boot()` sequence:**

1. Read `window.__lupa__` config injected by the plugin
2. If not debug mode: create `EventManager` (WebSocket sender)
3. Create `Emitter`, `WebRunner`, `Refiner`, `BrowserExceptionsManager`
4. Dynamically import test plugins
5. For each suite in `window.__lupa__.suites`:
   a. Create `Suite` instance, apply timeout/retries
   b. `import(fileURL)` each test file — catch errors, emit `runner:import_error`
   c. Add suite to `WebRunner`
6. `webRunner.start()` → emit `runner:start` (via WebSocket)
7. `webRunner.exec()` → run all suites
8. `webRunner.end()` → emit `runner:end` (via WebSocket)
9. `await delay(50)` — drain in-flight WS messages
10. `window.__lupa_runner_end__()` — notify Node that this page is done

---

### `src/testing/web_runner.ts` — WebRunner (browser side)

Browser-side peer of the Node `Runner`. Drives suite execution.

**`exec()`:**

1. Collect pinned tests from `Refiner`, emit `runner:pinned_tests`
2. If list mode: build and emit `runner:list` node tree
3. Else: call `suite.exec()` for each registered suite

---

### `src/testing/suite/` — Suite and SuiteRunner

`Suite` accumulates the test/group definitions gathered when a test file is imported. Its `exec()` method delegates to `SuiteRunner`.

**`SuiteRunner.run()` order:**

1. Emit `suite:start`
2. Run `setup` hooks
3. For each item in the stack (groups and tests in declaration order): call `item.exec()`
4. Run setup cleanup callbacks
5. Run `teardown` hooks
6. Run teardown cleanup callbacks
7. Emit `suite:end` with `hasError` and accumulated errors

---

### `src/testing/test/` — Test and TestRunner

`Test` holds the executor callback and options (timeout, retries, tags, datasets).

**`TestRunner.run()` order (per dataset row when parameterized):**

1. Emit `test:start`
2. Run `setup` hooks
3. Create test context object
4. Call executor callback (wrapped in timeout + retry logic)
5. Run cleanup callbacks
6. Run `teardown` hooks
7. Emit `test:end` with duration and error (if any)

**Timeout:** A `Promise.race` between the callback and a `setTimeout` rejection.
**Retry:** Failed tests are re-executed up to `options.retries` times; the loop stops on first pass.

---

### `src/refiner/main.ts` — Refiner

Stateless filter applied to every test and group before execution.

**Filter layers (checked in order):**

| Layer | CLI flag | Match logic |
| --- | --- | --- |
| `tests` | `--tests` | Test title must match (substring) |
| `tags` | `--tags` | Test must have at least one matching tag; negation with `!` or `~` |
| `groups` | `--groups` | Group title must match |
| pinned | set programmatically | Only pinned tests run |

If no filters are active, all tests pass.

---

## Event Reference

All events travel from browser → WebSocket → `ServerManager` → `activeNodeEmitter` → `Runner` → reporters and `Tracker`.

| Event | Payload highlights | Emitted by |
| --- | --- | --- |
| `runner:start` | `estimatedTotalFiles` | WebRunner |
| `runner:end` | `hasError` | WebRunner |
| `runner:import_error` | `file`, `error` | harness (import catch) |
| `runner:pinned_tests` | `tests[]` | WebRunner |
| `runner:list` | `RunnerListNode` | WebRunner |
| `suite:start` | `name`, `filesCount`, `browserId` | SuiteRunner |
| `suite:end` | `name`, `hasError`, `errors[]` | SuiteRunner |
| `group:start` | `title`, `file`, `browserId` | GroupRunner |
| `group:end` | `title`, `hasError`, `errors[]` | GroupRunner |
| `test:start` | `title`, `tags`, `isSkipped`, `isPinned` | TestRunner |
| `test:end` | `title`, `hasError`, `duration`, `errors[]` | TestRunner |
| `browser:log` | `method`, `args` | BrowserLogs (Node-only, not via WS) |
| `uncaught:exception` | `error`, `type` | BrowserExceptionsManager via WS |
