import { Command, Option } from 'commander'
import { loadLupaConfig, configure, runProgrammatic } from '../../../src/runner/index.js'
import { renderCriticalError } from '../errors.js'
import path from 'node:path'
import fs from 'node:fs'
import type { CLIArgs } from '../../../src/runner/types.js'
import { colors } from '../../../src/runner/helpers.js'
import { json } from '../../../src/reporters/index.js'
import type { RunnerListNode } from '../../../src/types.js'
import { Table } from 'console-table-printer'

export const listCommand = new Command('list')
  .description('Discover and list available tests without running them')
  .option('-c, --config <path>', 'Path to the configuration file', 'lupa.config.ts')
  .option('--tests <titles...>', 'Filter tests by the test title')
  .option('--groups <titles...>', 'Filter tests by the group title')
  .option('--tags <tags...>', 'Filter tests by tags')
  .option('--files <files...>', 'Filter tests by the file name')
  .option('--vite-config <path>', 'Path to a custom Vite configuration file')
  .option('--match-all', 'Run tests that matches all the supplied tags')
  .addOption(new Option('--format <format>', 'Output format for the list').choices(['table', 'json']).default('table'))
  .allowUnknownOption()
  .action(async (options, command) => {
    try {
      const cliArgs: CLIArgs = command.opts()
      cliArgs._ = command.args
      cliArgs.list = true

      let configPath = path.resolve(process.cwd(), options.config)
      if (options.config === 'lupa.config.ts' && !fs.existsSync(configPath)) {
        const jsConfigPath = path.resolve(process.cwd(), 'lupa.config.js')
        if (fs.existsSync(jsConfigPath)) {
          configPath = jsConfigPath
        }
      }

      const config = await loadLupaConfig(process.cwd(), configPath)
      if (!config) {
        renderCriticalError(
          'E_MISSING_CONFIG',
          `Could not load configuration file at ${configPath}.\nRun 'npx lupa init' to scaffold a new project.`
        )
      }

      configure(config, cliArgs)

      const result = await runProgrammatic(json())

      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2))
        return
      }

      if ('list' in result && result.success) {
        printTable(result.list)
      } else {
        console.error(colors.red('Failed to discover tests or unexpected result format.'))
        process.exit(1)
      }
    } catch (err) {
      renderCriticalError('E_TEST_LIST_FAILED', 'Failed to list tests.', err)
    }
  })

function printTable(listNode: RunnerListNode) {
  if (listNode.suites.length === 0) {
    console.log(colors.yellow('No tests found matching the current filters.'))
    return
  }

  const p = new Table({
    columns: [
      { name: 'suite', title: 'Suite', alignment: 'left' },
      { name: 'group', title: 'Group', alignment: 'left' },
      { name: 'test', title: 'Test Title', alignment: 'left' },
    ],
  })

  let count = 0

  for (const suite of listNode.suites) {
    const suiteName = suite.name

    for (const group of suite.groups) {
      const groupName = group.title

      for (const test of group.tests) {
        p.addRow({ suite: suiteName, group: groupName, test: test.title })
        count++
      }
    }

    for (const test of suite.tests) {
      p.addRow({ suite: suiteName, group: '-', test: test.title })
      count++
    }
  }

  if (count === 0) {
    console.log(colors.yellow('No tests found matching the current filters.'))
    return
  }

  p.printTable()
  console.log('')
  console.log(colors.dim(`Total tests: ${count}`))
}
