# Test Suites

Test suites allow you to organize your tests logically by their type or domain. For example, you can create separate suites for component unit tests and end-to-end user flows, keeping their test files in dedicated folders.

When using suites, you configure them in your `lupa.config.ts` file instead of using the top-level `files` property.

```ts
import { configure, run } from '@pawel-up/lupa/runner'

configure({
  suites: [
    {
      name: 'components',
      files: ['tests/components/**/*.spec.ts'],
    },
    {
      name: 'e2e',
      files: ['tests/e2e/**/*.spec.ts'],
    }
  ]
})

run()
```

- You **must not** use the root `files` property when you are using suites.
- Each suite must have a unique `name` and a `files` array to associate test files with the suite.

## Run selected suites

You can run tests for a specific suite by specifying the suite name as a positional argument after your test runner script.

In the following example, only the component tests will run:

```bash
npx lupa test components
```

The following example will run the tests for both the components and the e2e suites:

```bash
npx lupa test components e2e
```

## Lifecycle hooks & Global Setup

Unlike Japa, Lupa does not expose a `configure()` callback for individual suites. Because Lupa natively executes tests concurrently in a real browser, allowing per-suite Node.js configuration callbacks would introduce complex race conditions and orchestrator instability.

If you need to spin up an external mock backend server or start a database daemon before your tests run, you should use the [Lupa Plugin API](/guide/plugins). 

Plugins allow you to safely hook into the `boot`, `execute`, and `shutdown` phases of the global Orchestrator lifecycle.

## Running tests in parallel

By default, Lupa automatically runs your tests **in parallel** to speed up execution. Lupa natively manages concurrency by spinning up multiple Playwright browser pages simultaneously.

You do not need to use external tools like `concurrently` to run suites in parallel.

### Configuring Concurrency

You can control parallel execution in your `lupa.config.ts`:

```ts
import { defineConfig } from '@pawel-up/lupa/runner'

export default defineConfig({
  // Enable or disable parallel execution globally (default: true)
  parallel: true,
  
  // Set global concurrency. Can be 'auto' (default) or a specific number.
  concurrency: 'auto',

  suites: [
    {
      name: 'unit',
      files: ['tests/unit/**/*.spec.ts'],
      concurrency: 8, // Run unit tests with high parallelism
    },
    {
      name: 'e2e',
      files: ['tests/e2e/**/*.spec.ts'],
      concurrency: 1, // Force serial execution for stateful E2E tests
    },
  ]
})
```

### Dynamic Concurrency (`'auto'`) & Multi-Browser Scaling

When `concurrency` is set to `'auto'` (or omitted), Lupa dynamically scales worker allocation according to your hardware and test configuration:

1. **CPU Allocation**: Lupa allocates `Math.max(1, Math.floor(os.cpus().length / 2))` concurrent workers. Reserving headroom protects system responsiveness, prevents Playwright IPC channel saturation, and avoids false-positive test timeouts.
2. **Multi-Browser Scaling**: When running tests across multiple browser engines simultaneously (e.g. `['chromium', 'firefox', 'webkit']`), Lupa automatically divides the worker pool per browser:
   ```ts
   concurrencyPerBrowser = Math.max(1, Math.floor(defaultConcurrency / browserCount))
   ```
   This ensures that running multi-browser suites does not multiply the total process count beyond the machine's capacity.
3. **Explicit Overrides**: Any suite-specific numeric override (e.g., `concurrency: 1` or `concurrency: 8`) takes precedence over the `'auto'` calculation.

> [!NOTE]  
> ### Parallel Execution & Debug Mode
> When you enter Debug Mode (by pressing `d` from within an interactive `--watch` session), Lupa automatically restricts execution to a single browser window. This provides an interactive headed Playwright browser instance (using the first configured browser, such as Chrome or Firefox) with DevTools for visual debugging. While your configuration might specify higher concurrency or multiple browsers, they are temporarily ignored during a debug session to prevent conflicting windows.

