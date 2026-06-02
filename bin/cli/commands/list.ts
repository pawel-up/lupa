import { Command, Option } from 'commander'
import { loadLupaConfig, configure, runProgrammatic } from '../../../src/runner/index.js'
import { renderCriticalError } from '../errors.js'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { CLIArgs } from '../../../src/runner/types.js'
import { colors } from '../../../src/runner/helpers.js'
import { json } from '../../../src/reporters/index.js'
import type {
  RunnerListNode,
  RunnerListSuiteNode,
  RunnerListGroupNode,
  RunnerListTestNode,
} from '../../../src/types.js'
import { Table } from 'console-table-printer'
import { ConfigManager } from '../../../src/runner/config_manager.js'
import { Planner } from '../../../src/runner/planner.js'

export const listCommand = new Command('list')
  .description('Discover and list available tests without running them')
  .argument('[suites...]', 'Discover tests for specific suites')
  .option('-c, --config <path>', 'Path to the configuration file', 'lupa.config.ts')
  .option('--suites <names...>', 'Filter tests by suite name')
  .option('--tests <titles...>', 'Filter tests by the test title')
  .option('--groups <titles...>', 'Filter tests by the group title')
  .option('--tags <tags...>', 'Filter tests by tags')
  .option('--files <files...>', 'Filter tests by the file name')
  .option('--vite-config <path>', 'Path to a custom Vite configuration file')
  .option('--match-all', 'Run tests that matches all the supplied tags')
  .option('--files-only', 'List only the test files after applying configuration and CLI filters')
  .option('--search-files <queries...>', 'Search for test files with text search queries')
  .option('--search-tests <queries...>', 'Search for test titles with text search queries')
  .addOption(new Option('--format <format>', 'Output format for the list').choices(['table', 'json']).default('table'))
  .allowUnknownOption()
  .action(
    async (
      suites: string[],
      options: {
        config: string
        suites?: string[]
        tests?: string[]
        groups?: string[]
        tags?: string[]
        files?: string[]
        viteConfig?: string
        matchAll?: boolean
        format: 'table' | 'json'
        filesOnly?: boolean
        searchFiles?: string[]
        searchTests?: string[]
      },
      command
    ) => {
      try {
        const cliArgs: CLIArgs = command.opts()
        cliArgs._ = suites
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

        if (options.filesOnly || options.searchFiles) {
          const hydratedConfig = new ConfigManager(config, cliArgs).hydrate()
          const planner = new Planner(hydratedConfig)
          const plan = await planner.plan()

          const filesSet = new Set<string>()
          for (const suite of plan.suites) {
            for (const fileURL of suite.filesURLs) {
              const filePath = fileURLToPath(fileURL)
              const relativePath = path.relative(process.cwd(), filePath)
              filesSet.add(relativePath)
            }
          }

          let relativePaths = Array.from(filesSet).sort((a, b) => a.localeCompare(b))

          if (options.searchFiles && options.searchFiles.length > 0) {
            const queries = options.searchFiles.map((q) => q.toLowerCase())
            relativePaths = relativePaths.filter((filePath) =>
              queries.some((query) => filePath.toLowerCase().includes(query))
            )
          }

          if (options.format === 'json') {
            console.log(JSON.stringify(relativePaths, null, 2))
            return
          }

          printFilesTable(relativePaths)
          return
        }

        configure(config, cliArgs)

        const result = await runProgrammatic(json())

        if (!options.searchTests || options.searchTests.length === 0) {
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
        } else {
          if ('list' in result && result.success) {
            const list = filterListNode(result.list, options.searchTests)
            if (options.format === 'json') {
              console.log(JSON.stringify({ success: true, list }, null, 2))
              return
            }
            printTable(list)
          } else {
            console.error(colors.red('Failed to discover tests or unexpected result format.'))
            process.exit(1)
          }
        }
      } catch (err) {
        renderCriticalError('E_TEST_LIST_FAILED', 'Failed to list tests.', err)
      }
    }
  )

function printTable(listNode: RunnerListNode): void {
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

function printFilesTable(files: string[]): void {
  if (files.length === 0) {
    console.log(colors.yellow('No test files found matching the current filters.'))
    return
  }

  const p = new Table({
    columns: [{ name: 'file', title: 'Test File', alignment: 'left' }],
  })

  for (const file of files) {
    p.addRow({ file })
  }

  p.printTable()
  console.log('')
  console.log(colors.dim(`Total files: ${files.length}`))
}

function filterListNode(listNode: RunnerListNode, queries: string[]): RunnerListNode {
  const lowercaseQueries = queries.map((q) => q.toLowerCase())

  const filterTest = (test: RunnerListTestNode): boolean => {
    return lowercaseQueries.some((query) => test.title.toLowerCase().includes(query))
  }

  const filterGroup = (group: RunnerListGroupNode): RunnerListGroupNode | null => {
    const matchedTests = group.tests.filter(filterTest)
    const matchedGroups = group.groups.map(filterGroup).filter((g): g is RunnerListGroupNode => g !== null)

    if (matchedTests.length > 0 || matchedGroups.length > 0) {
      return {
        ...group,
        tests: matchedTests,
        groups: matchedGroups,
      }
    }
    return null
  }

  const filterSuite = (suite: RunnerListSuiteNode): RunnerListSuiteNode | null => {
    const matchedTests = suite.tests.filter(filterTest)
    const matchedGroups = suite.groups.map(filterGroup).filter((g): g is RunnerListGroupNode => g !== null)

    if (matchedTests.length > 0 || matchedGroups.length > 0) {
      return {
        ...suite,
        tests: matchedTests,
        groups: matchedGroups,
      }
    }
    return null
  }

  const matchedSuites = listNode.suites.map(filterSuite).filter((s): s is RunnerListSuiteNode => s !== null)

  return {
    suites: matchedSuites,
  }
}
