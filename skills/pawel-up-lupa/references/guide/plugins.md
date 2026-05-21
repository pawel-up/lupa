# Lupa Plugins API

Lupa's highly extensible architecture allows you to customize both the test execution environment and the test runner lifecycle itself. Because Lupa is powered by Vite under the hood, you have two distinct plugin ecosystems at your disposal: **Vite Plugins** and **Lupa Runner Plugins**. 

Lupa Runner Plugins are configured via the `runnerPlugins` array in your `lupa.config.ts`. They provide a powerful way to hook into the core test runner events to start services, collect telemetry, or reset backend state.

> [!NOTE]
> If you need to inject test logic directly into the **browser process** (e.g., adding a custom assertion library or setting up browser-side globals), use the `testPlugins` array in your configuration instead.

> [!NOTE]
> Lupa Runner Plugins execute entirely within the Node.js Orchestrator process. They do **not** run in the browser and do not have access to DOM or browser APIs like `window` or `document`.

## Vite Plugins vs. Lupa Runner Plugins

Because Lupa spins up a Vite dev server to bundle and serve your tests, you can (and should) use standard Vite plugins for many tasks. It is critical to understand the boundary between when to use a Vite Plugin versus a Lupa Runner Plugin.

**Vite Plugins** hook into the Dev Server lifecycle. Use them when you need to:
- Transform or compile code (e.g., stripping proprietary syntax).
- Inject mock API middlewares into the dev server.
- Alter the HTML/CSS served to the browser test harness.

*Brief Example: Adding a Vite plugin to inject middleware:*
```ts
// lupa.config.ts
import { defineConfig } from '@pawel-up/lupa'

export default defineConfig({
  vite: {
    plugins: [{
      name: 'mock-middleware',
      configureServer(server) {
        server.middlewares.use('/api/status', (req, res) => {
          res.end('ok')
        })
      }
    }]
  }
})
```

**Lupa Runner Plugins** hook into the Test Runner lifecycle. Use them when you need to:
- Start external services (like a database or proxy server) before the test suite begins.
- Reset backend state or clear caches before each test run.
- Hook into runner events to attach custom reporters or telemetry.

### Quick Comparison

| Feature / Task | Use a Vite Plugin | Use a Lupa Plugin |
| --- | --- | --- |
| Transform source code files | ✅ | ❌ |
| Start a database daemon on boot | ❌ | ✅ |
| Inject a dev server middleware | ✅ | ❌ |
| Reset database state before a run | ❌ | ✅ |
| Runs in Node.js | ✅ | ✅ |
| Bleeds into your production build | ❌ (Tests only) | ❌ (Tests only) |

## The Plugin Lifecycle

Lupa Runner Plugins execute through four distinct phases, allowing you to fine-tune setup and teardown processes—especially during interactive Watch Mode. All hooks support asynchronous execution (`async`/`Promise`).

### `plan`
Executed before the orchestrator fully boots and before test files are discovered.
- **Use when:** You need to dynamically inject test files or modify configuration defaults (e.g. forcing `--bail` in CI environments).
- **Never use for:** Starting services that need to be available during the test execution.

### `boot`
Executed **once** when the Orchestrator boots.
- **Use when:** Performing one-time global setup tasks, such as starting an external database daemon or a proxy server that must persist across watch-mode reruns.
- **Never use for:** Resetting state between individual test runs.

### `execute`
Executed **before a test execution cycle begins** (i.e., before the entire batch of tests starts). In watch mode, this runs multiple times whenever files change.
- **Use when:** Resetting external state (e.g., clearing a database) before an entire test suite run starts, or attaching custom telemetry to the event emitter.
- **Never use for:** Logic that needs to run before *each individual test* (use `testPlugins` for that), or starting heavy services that should persist across watch-mode runs (use `boot` instead).

### `shutdown`
Executed **once** when the Orchestrator completely shuts down.
- **Use when:** Finalizing custom reports or explicitly tearing down services if you aren't using the closure teardown pattern.

## Writing a Plugin (Closure Pattern)

Lupa embraces a modern **closure-based teardown pattern**. Instead of saving mutable state (like a server instance) to your plugin object just so the `shutdown` hook can access it later, your `boot` and `execute` hooks can simply **return a function**. Lupa will automatically collect these functions and execute them during the appropriate teardown phase.

### Example: Database Manager Plugin

Here is an example of a plugin that boots a database container once, and truncates the tables before every test execution cycle. Notice how we return teardown closures directly:

```ts
import type { LupaPlugin } from '@pawel-up/lupa/runner'

export function myDatabasePlugin(): LupaPlugin {
  return {
    name: 'database-manager',

    // Boot runs once per process. Start the DB daemon here.
    async boot() {
      console.log('Starting PostgreSQL container...')
      const db = await startDatabaseDaemon()

      // Return a closure to be executed on Orchestrator shutdown
      return async () => {
        console.log('Stopping PostgreSQL container...')
        await db.stop()
      }
    },

    // Execute runs before the entire batch of tests executes (multiple times in watch mode).
    async execute() {
      console.log('Truncating database tables for a fresh execution cycle...')
      await truncateAllTables()

      // Return a closure to be executed at the end of THIS specific execution cycle (runner:end)
      return async () => {
        console.log('Test execution cycle finished. Generating run metrics...')
      }
    }
  }
}
```

This pattern guarantees that your cleanup logic has direct scope access to the instances created during setup, entirely eliminating the need for outer-scoped `let dbInstance;` variables!

## Client-Side Test Plugins

While `runnerPlugins` run exclusively in the Node.js orchestrator, there are many scenarios where you need to inject code directly into the browser where tests are executing (e.g., setting up global browser mocks, importing custom DOM assertions, or attaching listeners to the browser-side test runner).

To do this, use the `testPlugins` array in your `lupa.config.ts`. 

Test plugins are specified as module import paths. Lupa will import these modules directly into the browser environment before any test files are executed. 

### Writing a Test Plugin

A test plugin must export a default `setup` function that conforms to the `WebPluginFn` type. This function receives a context object containing the `WebRunner`, `Emitter`, and `config`.

```ts
// src/plugins/my-browser-plugin.ts
import type { WebPluginFn } from '@pawel-up/lupa/testing'

const setup: WebPluginFn = ({ runner, emitter }) => {
  console.log('Browser plugin initialized!')

  // Hook into client-side runner events
  emitter.on('test:start', (test) => {
    console.log(`Starting test in browser: ${test.title}`)
  })
  
  // Inject global variables for tests
  window.__MY_GLOBAL_MOCK__ = true
}

export default setup
```

### Registering Test Plugins

Register the plugin in your `lupa.config.ts` using the `testPlugins` array.

```ts
import { defineConfig } from '@pawel-up/lupa'

export default defineConfig({
  testPlugins: [
    // Provide the path to the module
    './src/plugins/my-browser-plugin.ts',
    
    // You can also pass JSON-serializable options to your plugin
    ['./src/plugins/my-configurable-plugin.ts', { debug: true }]
  ]
})
```
