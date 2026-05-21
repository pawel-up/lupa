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
  // Enable or disable parallel execution (default: true)
  parallel: true,
  
  // Set the number of concurrent browser pages. 
  // Can be 'auto' (based on CPU cores) or a specific number.
  concurrency: 'auto'
})
```

> [!NOTE]  
> ### Parallel Execution & Debug Mode
> When you enter Debug Mode (by pressing `d` from within an interactive `--watch` session), Lupa automatically restricts execution to a single browser window. This provides an interactive headed Playwright browser instance (using the first configured browser, such as Chrome or Firefox) with DevTools for visual debugging. While your configuration might specify higher concurrency or multiple browsers, they are temporarily ignored during a debug session to prevent conflicting windows.

