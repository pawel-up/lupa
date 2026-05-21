# Project-Specific Conventions

## File Naming & Location

- Check the `lupa.config.js` or `lupa.config.ts` file for the test file locations.
- Comply with the project-specific file naming and location conventions.

### Example

If the config says:

```typescript
export default defineConfig({
  files: ['tests/**/*.spec.ts'],
})
```

Then create a file `tests/[relevant subdomain]/my-element.spec.ts` where the `[relevant subdomain]` can be a component name (one of many components) or a parent component name or an application name or a framework name ...etc. and `my-element.spec.ts` is the name of the test file.

Be mindful of test suites. If the user config defines those, use the corresponding suite to place the test file.

```ts
export default defineConfig({
  suites: [
    {
      name: 'unit',
      files: ['**/*.unit.spec.ts'],
    },
    {
      name: 'integration',
      files: ['**/*.integration.spec.ts'],
    },
    {
      name: 'e2e',
      files: ['**/*.e2e.spec.ts'],
    },
  ]
})
```
In that case, if the test file is for a unit test, it should be placed in `tests/unit/[relevant subdomain]/my-element.spec.ts`.

## Assertion Style

Lupa doesn't force a specific assertion library - you can use chai directly or any other assertion library. However, Lupa does ship with an officially supported, first-party assertion plugin: `@pawel-up/lupa/assert`. It provides a clean, chainable API built on top of Chai, and seamlessly integrates with Lupa's test context.

While it can be used with a direct import, we recommend registering the assert plugin on the test context.

In the lupa.config.ts file

```ts
import { defineConfig } from '@pawel-up/lupa/runner'

export default defineConfig({
  // ... other configuration options
  testPlugins: ['@pawel-up/lupa/assert'], // Register the assert plugin
})

// register types in a TypeScript file.
declare module '@pawel-up/lupa/testing' {
  interface TestContext {
    assert: Assert
  }
}
```

The `testPlugins` array takes names of the packages to load (can be a local path!). These plugins are then registered in the playwright harness.

The `@pawel-up/lupa/assert` plugin by default registers itself on the test context property `assert`. When using custom libraries, this step won't be performed automatically.

## Mocking Strategy

Use Lupa's native network mocking library provided by the `@pawel-up/lupa/network` module. First, it needs to be registered in the `lupa.config.ts` file.

```ts
import { defineConfig } from '@pawel-up/lupa/runner'
import type { Assert } from '@pawel-up/lupa/assert'
import type { Network } from '@pawel-up/lupa/network'

export default defineConfig({
  // ... other configuration options
  testPlugins: ['@pawel-up/lupa/assert', '@pawel-up/lupa/network'], // Register the network plugin
})

declare module '@pawel-up/lupa/testing' {
  interface TestContext {
    assert: Assert
    network: Network
  }
}
```

Once that is done, the `network` property will be available in the test context.

```ts
// my-element.e2e.spec.ts
import { test } from '@pawel-up/lupa/testing'

test('should mock a network request', async ({ network, page }) => {
  const handler = await network.mock('/api/users/1', {
    status: 200,
    body: JSON.stringify({ id: 1, name: 'Alice', role: 'admin' }),
    headers: { 'Content-Type': 'application/json' }
  })

  await fetch('/api/users/1')

  await handler.assert.calledOnce()
})
```
