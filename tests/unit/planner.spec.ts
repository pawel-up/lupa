import { test } from 'node:test'
import path from 'node:path'
import assert from 'node:assert'
import { Planner } from '../../src/runner/planner.js'
import { progress, dot, NamedReporterContract } from '../../src/reporters/index.js'
import { ConfigManager } from '../../src/runner/config_manager.js'
import { wrapAssertions, listAllTestFiles } from './helpers.js'

test.describe('Planner | suites', () => {
  test('returns multiple suites when defined', async () => {
    const config = new ConfigManager(
      {
        suites: [
          { name: 'unit', files: ['tests/unit/**/*.spec.ts'] },
          { name: 'integration', files: ['tests/integration/**/*.spec.ts'] },
        ],
      },
      {}
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.strictEqual(suites.length, 2)
      assert.strictEqual(suites[0].name, 'unit')
      assert.strictEqual(suites[1].name, 'integration')
    })
  })

  test('filters suites by name', async () => {
    const config = new ConfigManager(
      {
        suites: [
          { name: 'unit', files: ['tests/unit/**/*.spec.ts'] },
          { name: 'integration', files: ['tests/integration/**/*.spec.ts'] },
        ],
        filters: { suites: ['unit'] },
      },
      {}
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.strictEqual(suites.length, 1)
      assert.strictEqual(suites[0].name, 'unit')
    })
  })
})

test.describe('Planner | reporters', () => {
  test('activates dot and github reporters in GitHub Actions', async () => {
    // Store original env
    const originalCI = process.env.CI
    const originalGH = process.env.GITHUB_ACTIONS

    try {
      process.env.CI = 'true'
      process.env.GITHUB_ACTIONS = 'true'

      const config = new ConfigManager({ files: ['tests/**/*.spec.ts'] }, {}).hydrate()
      const { reporters } = await new Planner(config).plan()
      await wrapAssertions(() => {
        assert.strictEqual(reporters.length, 2)
        assert.strictEqual(reporters[0].name, 'dot')
        assert.strictEqual(reporters[1].name, 'github')
      })
    } finally {
      // Restore env
      process.env.CI = originalCI
      process.env.GITHUB_ACTIONS = originalGH
    }
  })

  test('get collection of manually activated reporters', async () => {
    const config = new ConfigManager(
      { files: [], reporters: { activated: ['progress'], list: [progress(), dot()] } },
      {}
    ).hydrate()
    const { reporters } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.strictEqual(reporters.length, 1)
      assert.strictEqual(reporters[0].name, 'progress')
    })
  })

  test('get collection of reporters activated via CLI flag', async () => {
    const config = new ConfigManager(
      { files: [], reporters: { activated: ['progress'], list: [progress(), dot()] } },
      { reporters: ['dot'] }
    ).hydrate()
    const { reporters } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.strictEqual(reporters.length, 1)
      assert.strictEqual(reporters[0].name, 'dot')
    })
  })

  test('fallback to default reporter when not in the custom list', async () => {
    const config = new ConfigManager(
      { files: [], reporters: { activated: ['ndjson'], list: [progress()] } },
      {}
    ).hydrate()
    const { reporters } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.strictEqual(reporters.length, 1)
      assert.strictEqual(reporters[0].name, 'ndjson')
    })
  })

  test('custom reporters take precedence over default reporters on name collision', async () => {
    const customNdjson: NamedReporterContract = {
      name: 'ndjson',
      handler: async () => {},
    }
    const config = new ConfigManager(
      { files: [], reporters: { activated: ['ndjson'], list: [customNdjson] } },
      {}
    ).hydrate()
    const { reporters } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.strictEqual(reporters.length, 1)
      assert.strictEqual(reporters[0], customNdjson)
    })
  })

  test('uses default reporters when none are defined in config', async () => {
    const config = new ConfigManager({ files: [] }, {}).hydrate()
    const { reporters } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.strictEqual(reporters.length, config.reporters.activated.length)
      assert.strictEqual(reporters[0].name, config.reporters.activated[0])
    })
  })

  test('report error when activated reporter is not in the list', async () => {
    const config = new ConfigManager(
      { files: [], reporters: { activated: ['unknown'], list: [progress()] } },
      {}
    ).hydrate()

    await wrapAssertions(() => {
      assert.throws(
        () => new Planner(config),
        /Invalid reporter "unknown". Make sure to register it first inside the "reporters.list" array/
      )
    })
  })

  test('report error when CLI activated reporter is not in the list', async () => {
    const config = new ConfigManager(
      { files: [], reporters: { activated: ['progress'], list: [progress()] } },
      { reporters: ['unknown'] }
    ).hydrate()

    await wrapAssertions(() => {
      assert.throws(
        () => new Planner(config),
        /Invalid reporter "unknown". Make sure to register it first inside the "reporters.list" array/
      )
    })
  })
})

test.describe('Planner | refinerFilters', () => {
  test('collects tags, tests, and groups filters', async () => {
    const config = new ConfigManager(
      { files: [], filters: { tags: ['@slow'], tests: ['Math works'], groups: ['Math'] } },
      {}
    ).hydrate()
    const { refinerFilters } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.strictEqual(refinerFilters.length, 3)
      assert.deepStrictEqual(refinerFilters.find((f) => f.layer === 'tags')?.filters, ['@slow'])
      assert.deepStrictEqual(refinerFilters.find((f) => f.layer === 'tests')?.filters, ['Math works'])
      assert.deepStrictEqual(refinerFilters.find((f) => f.layer === 'groups')?.filters, ['Math'])
    })
  })

  test('ignores suites and files filters in refiner', async () => {
    const config = new ConfigManager(
      {
        suites: [{ name: 'unit', files: ['tests/unit/**/*.spec.ts'] }],
        filters: { suites: ['unit'], files: ['math.spec.ts'] },
      },
      {}
    ).hydrate()
    const { refinerFilters } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.strictEqual(refinerFilters.length, 0)
    })
  })
})

test.describe('Planner | files', () => {
  test('get suites for files', async () => {
    const config = new ConfigManager({ files: ['tests/**/*.spec.ts'] }, {}).hydrate()
    const { suites } = await new Planner(config).plan()
    const allFiles = await listAllTestFiles()
    const testFiles = allFiles.map((file) => new URL(path.join('..', file), import.meta.url))

    await wrapAssertions(() => {
      assert.deepStrictEqual(suites, [
        {
          name: 'default',
          files: ['tests/**/*.spec.ts'],
          filesURLs: testFiles,
          retries: 0,
          timeout: 2000,
        },
      ])
    })
  })

  test('apply files filter to the list', async () => {
    const config = new ConfigManager(
      { files: ['tests/**/*.spec.ts'], filters: { files: ['summary_builder'] } },
      {}
    ).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.deepStrictEqual(suites, [
        {
          name: 'default',
          files: ['tests/**/*.spec.ts'],
          filesURLs: [new URL('./summary_builder.spec.ts', import.meta.url)],
          retries: 0,
          timeout: 2000,
        },
      ])
    })
  })

  test('use inline global timeout', async () => {
    const config = new ConfigManager({ files: ['tests/**/*.spec.ts'], timeout: 1000 }, {}).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.equal(suites[0].timeout, 1000)
    })
  })

  test('use cli timeout', async () => {
    const config = new ConfigManager({ files: ['tests/**/*.spec.ts'] }, { timeout: '3000' }).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.equal(suites[0].timeout, 3000)
    })
  })

  test('use inline global retries', async () => {
    const config = new ConfigManager({ files: ['tests/**/*.spec.ts'], retries: 1 }, {}).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.equal(suites[0].retries, 1)
    })
  })

  test('use cli retries', async () => {
    const config = new ConfigManager({ files: ['tests/**/*.spec.ts'] }, { retries: '5' }).hydrate()
    const { suites } = await new Planner(config).plan()

    await wrapAssertions(() => {
      assert.equal(suites[0].retries, 5)
    })
  })
})
