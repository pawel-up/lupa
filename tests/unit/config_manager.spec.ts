import { test } from 'node:test'
import assert from 'node:assert'
import { ConfigManager } from '../../src/runner/config_manager.js'
import type { Config, CLIArgs } from '../../src/runner/types.js'

test('ConfigManager', async (t) => {
  await t.test('hydrates default configuration', () => {
    const config: Config = { files: [] }
    const cliArgs: CLIArgs = { _: [] }
    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.strictEqual(hydrated.timeout, 2000)
    assert.strictEqual(hydrated.retries, 0)
    assert.ok(hydrated.reporters.list.length > 0)
    assert.deepStrictEqual(hydrated.filters, {})
    assert.ok('files' in hydrated)
  })

  await t.test('merges CLI filters', () => {
    const config: Config = { files: [] }
    const cliArgs: CLIArgs = {
      _: ['unit', 'e2e'],
      tags: '@fast,@slow',
      tests: ['Math works'],
      groups: 'Math,Physics', // groups is parsed with splitByComma = false
      files: 'user.spec.ts',
    }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.deepStrictEqual(hydrated.filters.tags, ['@fast', '@slow'])
    assert.deepStrictEqual(hydrated.filters.tests, ['Math works'])
    assert.deepStrictEqual(hydrated.filters.groups, ['Math,Physics'])
    assert.deepStrictEqual(hydrated.filters.files, ['user.spec.ts'])
    assert.deepStrictEqual(hydrated.filters.suites, ['unit', 'e2e'])
  })

  await t.test('merges CLI filters and prioritizes explicit suites option', () => {
    const config: Config = { files: [] }
    const cliArgs: CLIArgs = {
      _: ['unit'],
      suites: 'functional,integration',
    }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.deepStrictEqual(hydrated.filters.suites, ['functional', 'integration'])
  })

  await t.test('overwrites config with CLI args', () => {
    const config: Config = { files: [], timeout: 5000, retries: 2 }
    const cliArgs: CLIArgs = { _: [], timeout: '1000', retries: '5' }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.strictEqual(hydrated.timeout, 1000)
    assert.strictEqual(hydrated.retries, 5)
  })

  await t.test('preserves suites configuration', () => {
    const config: Config = {
      suites: [
        { name: 'unit', files: 'tests/unit/**/*.ts' },
        { name: 'e2e', files: 'tests/e2e/**/*.ts', timeout: 5000 },
      ],
    }
    const cliArgs: CLIArgs = { _: [] }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    if ('suites' in hydrated) {
      assert.strictEqual(hydrated.suites.length, 2)
      assert.strictEqual(hydrated.suites[0].timeout, 2000) // Default fallback
      assert.strictEqual(hydrated.suites[1].timeout, 5000) // Explicit override
    } else {
      assert.fail('Expected suites to be defined')
    }
  })

  await t.test('CLI overrides suite configuration', () => {
    const config: Config = {
      suites: [{ name: 'unit', files: 'tests/unit/**/*.ts', timeout: 5000, retries: 2 }],
    }
    const cliArgs: CLIArgs = { _: [], timeout: '1000', retries: '5' }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    if ('suites' in hydrated) {
      assert.strictEqual(hydrated.suites[0].timeout, 1000)
      assert.strictEqual(hydrated.suites[0].retries, 5)
    } else {
      assert.fail('Expected suites to be defined')
    }
  })

  await t.test('merges reporters from CLI', () => {
    const config: Config = { files: [] }
    const cliArgs: CLIArgs = { _: [], reporters: 'dot,github' }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.deepStrictEqual(hydrated.reporters.activated, ['dot', 'github'])
  })

  await t.test('extracts viteConfig from CLI args', () => {
    const config: Config = { files: [] }
    const cliArgs: CLIArgs = { _: [], viteConfig: 'custom-vite.ts' }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.strictEqual(hydrated.viteConfig, 'custom-vite.ts')
  })

  await t.test('throws when both viteConfig and inline vite config are specified', () => {
    const config: Config = { files: [], vite: { plugins: [] } }
    const cliArgs: CLIArgs = { _: [], viteConfig: 'custom-vite.ts' }

    const manager = new ConfigManager(config, cliArgs)

    assert.throws(() => manager.hydrate(), /Cannot specify both a vite config file and an inline vite config/)
  })

  await t.test('preserves harness configuration', () => {
    const config: Config = {
      files: [],
      harness: {
        stylesheets: ['styles.css'],
        template: '<!-- lupa-scripts -->',
      },
    }
    const cliArgs: CLIArgs = { _: [] }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.ok(hydrated.harness)
    assert.deepStrictEqual(hydrated.harness.stylesheets, ['styles.css'])
    assert.strictEqual(hydrated.harness.template, '<!-- lupa-scripts -->')
  })

  await t.test('enables coverage and sets overrides from CLI options', () => {
    const config: Config = { files: [] }
    const cliArgs: CLIArgs = {
      _: [],
      coverageReporters: 'html,json',
      coverageDir: './custom-coverage-dir',
    }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.ok(hydrated.coverage)
    assert.ok(typeof hydrated.coverage === 'object')
    assert.deepStrictEqual(hydrated.coverage.reporters, ['html', 'json'])
    assert.strictEqual(hydrated.coverage.reportsDirectory, './custom-coverage-dir')
  })

  await t.test('keeps coverage disabled if CLI explicitly disables it', () => {
    const config: Config = { files: [], coverage: { reporters: ['html'] } }
    const cliArgs: CLIArgs = { _: [], coverage: false }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.strictEqual(hydrated.coverage, false)
  })

  await t.test('keeps coverage disabled if only configured in config file without being enabled', () => {
    const config: Config = { files: [], coverage: { thresholds: { lines: 80 } } }
    const cliArgs: CLIArgs = { _: [] }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.strictEqual(hydrated.coverage, false)
  })

  await t.test('enables coverage if explicitly set to true in config file', () => {
    const config: Config = { files: [], coverage: true }
    const cliArgs: CLIArgs = { _: [] }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.deepStrictEqual(hydrated.coverage, { enabled: true })
  })

  await t.test('enables coverage if enabled: true is defined in config coverage options', () => {
    const config: Config = { files: [], coverage: { enabled: true, thresholds: { lines: 80 } } }
    const cliArgs: CLIArgs = { _: [] }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.deepStrictEqual(hydrated.coverage, { enabled: true, thresholds: { lines: 80 } })
  })

  await t.test('enables coverage if config coverage is defined but CLI requested coverage', () => {
    const config: Config = { files: [], coverage: { thresholds: { lines: 80 } } }
    const cliArgs: CLIArgs = { _: [], coverage: true }

    const manager = new ConfigManager(config, cliArgs)
    const hydrated = manager.hydrate()

    assert.deepStrictEqual(hydrated.coverage, { enabled: true, thresholds: { lines: 80 } })
  })
})
