import { test } from 'node:test'
import assert from 'node:assert'
import { Orchestrator } from '../../../src/runner/orchestrator.js'
import type { NormalizedConfig, LupaPlugin } from '../../../src/runner/types.js'
import type { NamedReporterContract } from '../../../src/types.js'

const dummySuite = {
  name: 'dummy',
  files: ['dummy.spec.ts'],
  timeout: 2000,
  retries: 0,
  filesURLs: [new URL('file:///dummy.spec.ts')],
}

test('Runner Plugins Lifecycle', async (t) => {
  await t.test('executes plugins in the correct order with teardowns', async () => {
    const executedHooks: string[] = []

    const dummyPlugin: LupaPlugin = {
      name: 'dummy-plugin',
      plan: () => {
        executedHooks.push('plan')
        return () => {
          executedHooks.push('plan:teardown')
        }
      },
      boot: () => {
        executedHooks.push('boot')
        return () => {
          executedHooks.push('boot:teardown')
        }
      },
      execute: () => {
        executedHooks.push('execute')
        return () => {
          executedHooks.push('execute:teardown')
        }
      },
      shutdown: () => {
        executedHooks.push('shutdown')
      },
    }

    const config = {
      cwd: process.cwd(),
      runnerPlugins: [dummyPlugin],
      filters: {},
      refiner: {
        add: () => {},
        matchAllTags: () => {},
      } as any,
    } as NormalizedConfig

    const orchestrator = new Orchestrator(config, {}, [] as NamedReporterContract[], [dummySuite], [])

    // Simulate Plan hook execution since it's done before Orchestrator
    const planTeardown = dummyPlugin.plan!({ config, cliArgs: {} })
    if (typeof planTeardown === 'function') {
      orchestrator.registerTeardowns([planTeardown])
    }

    // Mock methods that launch actual services/browsers.
    // navigateAndWait never resolves so #runWaves() hangs, letting the test
    // manually control when runner:end fires.
    orchestrator.serverManager = { boot: async () => 'http://localhost' } as any
    orchestrator.browserManager = {
      boot: async () => {},
      navigateAndWait: () => new Promise(() => {}),
      close: async () => {},
    } as any

    // Run boot
    await orchestrator.boot()
    assert.strictEqual(executedHooks[0], 'plan')
    assert.strictEqual(executedHooks[1], 'boot')

    // Run execute
    await orchestrator.executeTests()
    assert.strictEqual(executedHooks[2], 'execute')

    // Simulate end of test cycle
    await orchestrator.activeNodeEmitter?.emit('runner:end', { hasError: false })

    // Check if execute teardown ran
    assert.strictEqual(executedHooks[3], 'execute:teardown')

    // Run shutdown
    await orchestrator.shutdown(0, { preventExit: true })

    // Check shutdown and plan/boot teardowns
    assert.strictEqual(executedHooks[4], 'shutdown')
    assert.strictEqual(executedHooks[5], 'plan:teardown')
    assert.strictEqual(executedHooks[6], 'boot:teardown')
  })

  await t.test('handles hook errors gracefully', async () => {
    const executedHooks: string[] = []

    const badPlugin: LupaPlugin = {
      name: 'bad-plugin',
      plan: () => () => {
        throw new Error('plan teardown failed')
      },
      boot: () => () => {
        throw new Error('boot teardown failed')
      },
      execute: () => () => {
        throw new Error('execute teardown failed')
      },
      shutdown: () => {
        throw new Error('shutdown hook failed')
      },
    }

    const goodPlugin: LupaPlugin = {
      name: 'good-plugin',
      plan: () => () => {
        executedHooks.push('good:plan:teardown')
      },
      boot: () => () => {
        executedHooks.push('good:boot:teardown')
      },
      execute: () => () => {
        executedHooks.push('good:execute:teardown')
      },
      shutdown: () => {
        executedHooks.push('good:shutdown')
      },
    }

    const config = {
      cwd: process.cwd(),
      runnerPlugins: [badPlugin, goodPlugin],
      filters: {},
      refiner: {
        add: () => {},
        matchAllTags: () => {},
      } as any,
    } as NormalizedConfig

    const orchestrator = new Orchestrator(config, {}, [] as NamedReporterContract[], [dummySuite], [])

    // Simulate Plan hook execution
    const badPlanTeardown = badPlugin.plan!({ config, cliArgs: {} })
    const goodPlanTeardown = goodPlugin.plan!({ config, cliArgs: {} })
    orchestrator.registerTeardowns([badPlanTeardown as any, goodPlanTeardown as any])

    orchestrator.serverManager = { boot: async () => 'http://localhost' } as any
    orchestrator.browserManager = {
      boot: async () => {},
      navigateAndWait: () => new Promise(() => {}),
      close: async () => {},
    } as any

    await orchestrator.boot()
    await orchestrator.executeTests()

    // Test execute teardowns gracefully handling errors
    await orchestrator.activeNodeEmitter?.emit('runner:end', { hasError: false })
    assert.ok(executedHooks.includes('good:execute:teardown'))

    // Test shutdown and plan/boot teardowns gracefully handling errors
    await orchestrator.shutdown(0, { preventExit: true })

    assert.ok(executedHooks.includes('good:shutdown'))
    assert.ok(executedHooks.includes('good:plan:teardown'))
    assert.ok(executedHooks.includes('good:boot:teardown'))
  })

  await t.test('handles asynchronous hooks and teardowns properly', async () => {
    const executedHooks: string[] = []

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const asyncPlugin: LupaPlugin = {
      name: 'async-plugin',
      plan: async () => {
        await delay(10)
        executedHooks.push('async:plan')
        return async () => {
          await delay(10)
          executedHooks.push('async:plan:teardown')
        }
      },
      boot: async () => {
        await delay(10)
        executedHooks.push('async:boot')
        return async () => {
          await delay(10)
          executedHooks.push('async:boot:teardown')
        }
      },
      execute: async () => {
        await delay(10)
        executedHooks.push('async:execute')
        return async () => {
          await delay(10)
          executedHooks.push('async:execute:teardown')
        }
      },
      shutdown: async () => {
        await delay(10)
        executedHooks.push('async:shutdown')
      },
    }

    const config = {
      cwd: process.cwd(),
      runnerPlugins: [asyncPlugin],
      filters: {},
      refiner: { add: () => {}, matchAllTags: () => {} } as any,
    } as NormalizedConfig

    const orchestrator = new Orchestrator(config, {}, [] as NamedReporterContract[], [dummySuite], [])
    const planTeardown = await asyncPlugin.plan!({ config, cliArgs: {} })
    orchestrator.registerTeardowns([planTeardown as any])

    orchestrator.serverManager = { boot: async () => 'http://localhost' } as any
    orchestrator.browserManager = {
      boot: async () => {},
      navigateAndWait: () => new Promise(() => {}),
      close: async () => {},
    } as any

    await orchestrator.boot()
    assert.strictEqual(executedHooks.length, 2)
    assert.strictEqual(executedHooks[1], 'async:boot')

    await orchestrator.executeTests()
    assert.strictEqual(executedHooks.length, 3)
    assert.strictEqual(executedHooks[2], 'async:execute')

    await orchestrator.activeNodeEmitter?.emit('runner:end', { hasError: false })
    assert.strictEqual(executedHooks[3], 'async:execute:teardown')

    await orchestrator.shutdown(0, { preventExit: true })
    assert.strictEqual(executedHooks[4], 'async:shutdown')
    assert.strictEqual(executedHooks[5], 'async:plan:teardown')
    assert.strictEqual(executedHooks[6], 'async:boot:teardown')
  })

  await t.test('executes multiple plugins sequentially', async () => {
    const executedHooks: string[] = []

    const plugin1: LupaPlugin = {
      name: 'plugin-1',
      boot: () => {
        executedHooks.push('plugin1:boot')
        return () => {
          executedHooks.push('plugin1:teardown')
        }
      },
    }

    const plugin2: LupaPlugin = {
      name: 'plugin-2',
      boot: () => {
        executedHooks.push('plugin2:boot')
        return () => {
          executedHooks.push('plugin2:teardown')
        }
      },
    }

    const config = {
      cwd: process.cwd(),
      runnerPlugins: [plugin1, plugin2],
      filters: {},
      refiner: { add: () => {}, matchAllTags: () => {} } as any,
    } as NormalizedConfig

    const orchestrator = new Orchestrator(config, {}, [] as NamedReporterContract[], [dummySuite], [])
    orchestrator.serverManager = { boot: async () => 'http://localhost' } as any
    orchestrator.browserManager = {
      boot: async () => {},
      navigateAndWait: () => new Promise(() => {}),
      close: async () => {},
    } as any

    await orchestrator.boot()
    assert.strictEqual(executedHooks[0], 'plugin1:boot')
    assert.strictEqual(executedHooks[1], 'plugin2:boot')

    await orchestrator.shutdown(0, { preventExit: true })
    assert.strictEqual(executedHooks[2], 'plugin1:teardown')
    assert.strictEqual(executedHooks[3], 'plugin2:teardown')
  })
})

test.describe('Ignoring lifecycle methods on plugins', () => {
  test('plan only', async () => {
    const plugin: LupaPlugin = {
      name: 'plan-plugin',
      plan: () => () => {},
    }

    const config = {
      cwd: process.cwd(),
      runnerPlugins: [plugin],
      filters: {},
      refiner: { add: () => {}, matchAllTags: () => {} } as any,
    } as NormalizedConfig

    const orchestrator = new Orchestrator(config, {}, [], [dummySuite], [])
    orchestrator.serverManager = { boot: async () => 'http://localhost' } as any
    orchestrator.browserManager = {
      boot: async () => {},
      navigateAndWait: () => new Promise(() => {}),
      close: async () => {},
    } as any

    await assert.doesNotReject(async () => {
      await orchestrator.boot()
      await orchestrator.executeTests()
      await orchestrator.activeNodeEmitter?.emit('runner:end', { hasError: false })
      await orchestrator.shutdown(0, { preventExit: true })
    })
  })

  test('boot only', async () => {
    const plugin: LupaPlugin = {
      name: 'boot-plugin',
      boot: () => () => {},
    }

    const config = {
      cwd: process.cwd(),
      runnerPlugins: [plugin],
      filters: {},
      refiner: { add: () => {}, matchAllTags: () => {} } as any,
    } as NormalizedConfig

    const orchestrator = new Orchestrator(config, {}, [], [dummySuite], [])
    orchestrator.serverManager = { boot: async () => 'http://localhost' } as any
    orchestrator.browserManager = {
      boot: async () => {},
      navigateAndWait: () => new Promise(() => {}),
      close: async () => {},
    } as any

    await assert.doesNotReject(async () => {
      await orchestrator.boot()
      await orchestrator.executeTests()
      await orchestrator.activeNodeEmitter?.emit('runner:end', { hasError: false })
      await orchestrator.shutdown(0, { preventExit: true })
    })
  })

  test('execute only', async () => {
    const plugin: LupaPlugin = {
      name: 'execute-plugin',
      execute: () => () => {},
    }

    const config = {
      cwd: process.cwd(),
      runnerPlugins: [plugin],
      filters: {},
      refiner: { add: () => {}, matchAllTags: () => {} } as any,
    } as NormalizedConfig

    const orchestrator = new Orchestrator(config, {}, [], [dummySuite], [])
    orchestrator.serverManager = { boot: async () => 'http://localhost' } as any
    orchestrator.browserManager = {
      boot: async () => {},
      navigateAndWait: () => new Promise(() => {}),
      close: async () => {},
    } as any

    await assert.doesNotReject(async () => {
      await orchestrator.boot()
      await orchestrator.executeTests()
      await orchestrator.activeNodeEmitter?.emit('runner:end', { hasError: false })
      await orchestrator.shutdown(0, { preventExit: true })
    })
  })

  test('shutdown only', async () => {
    const plugin: LupaPlugin = {
      name: 'shutdown-plugin',
      shutdown: async () => {},
    }

    const config = {
      cwd: process.cwd(),
      runnerPlugins: [plugin],
      filters: {},
      refiner: { add: () => {}, matchAllTags: () => {} } as any,
    } as NormalizedConfig

    const orchestrator = new Orchestrator(config, {}, [], [dummySuite], [])
    orchestrator.serverManager = { boot: async () => 'http://localhost' } as any
    orchestrator.browserManager = {
      boot: async () => {},
      navigateAndWait: () => new Promise(() => {}),
      close: async () => {},
    } as any

    await assert.doesNotReject(async () => {
      await orchestrator.boot()
      await orchestrator.executeTests()
      await orchestrator.activeNodeEmitter?.emit('runner:end', { hasError: false })
      await orchestrator.shutdown(0, { preventExit: true })
    })
  })
})
