import { Command, Option } from 'commander'
import { loadLupaConfig, configure, run } from '../../../src/runner/index.js'
import { renderCriticalError } from '../errors.js'
import path from 'node:path'
import fs from 'node:fs'
import type { CLIArgs } from '../../../src/runner/types.js'
import { colors } from '../../../src/runner/helpers.js'

const examples = `
${colors.yellow('Examples:')}
  $ npx lupa test                                          ${colors.dim('# Run all tests')}
  $ npx lupa test --files auth.spec.ts                     ${colors.dim('# Run tests in a specific file')}
  $ npx lupa test --files="functional/user"                ${colors.dim('# Run tests in a specific directory')}
  $ npx lupa test --tags="@github"                         ${colors.dim('# Run tests that match any of the tags')}
  $ npx lupa test --tags="~@github"                        ${colors.dim('# Run tests that exclude the tag')}
  $ npx lupa test --tags="@regression,@slow"               ${colors.dim('# Run tests that match any of the tags')}
  $ npx lupa test --tags="@regression,@slow" --match-all   ${colors.dim('# Run tests that match all tags')}
  $ npx lupa test --tests "Login"                          ${colors.dim('# Run tests with a specific title')}
  $ npx lupa test --parallel                               ${colors.dim('# Run tests in parallel')}
  $ npx lupa test --watch                                  ${colors.dim('# Watch for file changes and re-run tests')}
  $ npx lupa test --coverage                               ${colors.dim('# Run tests with coverage reporting')}
  $ npx lupa test --reporters html                         ${colors.dim('# Run tests with html reporter')}
  $ npx lupa test --config lupa.config.ts                  ${colors.dim('# Run tests with a custom config file')}
`

const notes = `
${colors.yellow('Notes:')}
  - When groups and tests filters are applied together. We will first filter the
    tests by group title and then apply the tests filter.
  - The timeout defined on test object takes precedence over the ${colors.green('--timeout')} flag.
  - The retries defined on test object takes precedence over the ${colors.green('--retries')} flag.
  - The ${colors.green('--files')} flag checks for the file names ending with the filter substring.
  - The ${colors.green('--tags')} filter runs tests that has one or more of the supplied tags.
  - You can use the ${colors.green('--match-all')} flag to run tests that has all the supplied tags.
`

export const testCommand = new Command('test')
  .description('Run Lupa tests')
  .argument('[suites...]', 'Run specific test suites')
  .option('-c, --config <path>', 'Path to the configuration file', 'lupa.config.ts')
  .option('--suites <names...>', 'Filter tests by suite name')
  .option('--tests <titles...>', 'Filter tests by the test title')
  .option('--groups <titles...>', 'Filter tests by the group title')
  .option('--tags <tags...>', 'Filter tests by tags')
  .option('--files <files...>', 'Filter tests by the file name')
  .option('--timeout <duration>', 'Define default timeout for all tests')
  .option('--retries <count>', 'Define default retries for all tests')
  .option('--reporters <names...>', 'Activate one or more test reporters')
  .option('--bail-layer <layer>', 'Specify at which layer to enable the bail mode')
  .addOption(
    new Option('--browser <browser...>', 'Specify the browser to run tests in').choices([
      'chromium',
      'firefox',
      'webkit',
    ])
    // .default('chromium')
  )
  .option('--vite-config <path>', 'Path to a custom Vite configuration file')
  .option('--match-all', 'Run tests that matches all the supplied tags')
  .option('--failed', 'Run tests failed during the last run')
  .option('--bail', 'Exit early when a test fails')
  .option('--list-pinned', 'List pinned tests')
  .option('--watch', 'Watch for file changes and re-run tests')
  .option('--verbose', 'Enable verbose logging')
  .option('--force-exit', 'Forcefully exit the process')
  // .option('--parallel', 'Enable parallel execution')
  // .option('--no-parallel', 'Disable parallel execution')
  // .option('--concurrency <concurrency>', 'Number of concurrent pages per browser')
  .option('--coverage', 'Enable code coverage reporting')
  .option('--coverage-reporters <reporters...>', 'Specify coverage reporters (e.g. text, html, lcov)')
  .option('--coverage-dir <dir>', 'Specify the directory to write coverage reports to')
  .addHelpText('after', examples)
  .addHelpText('after', notes)
  .action(async (suites, options, command) => {
    try {
      // 1. Process arguments for the test runner.
      const cliArgs: CLIArgs = command.opts()
      cliArgs._ = suites

      // 2. Load Configuration
      let configPath = path.resolve(process.cwd(), options.config)

      // If using the default config, gracefully fallback to .js if .ts doesn't exist
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

      config.configPath = configPath

      // 3. Configure and execute tests
      console.log(
        `\n  🔎 ${colors.magenta(colors.bold('LUPA'))} ${colors.dim('The modern browser testing framework')}\n`
      )
      configure(config, cliArgs)
      await run()
    } catch (err) {
      renderCriticalError('E_TEST_RUN_FAILED', 'Failed to execute test run.', err)
    }
  })
