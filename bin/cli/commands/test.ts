import { Command } from 'commander'
import { loadLupaConfig, configure, processCLIArgs, run } from '../../../src/runner/index.js'
import { renderCriticalError } from '../errors.js'
import path from 'node:path'
import fs from 'node:fs'

export const testCommand = new Command('test')
  .description('Run Lupa tests using lupa.config.ts')
  .option('-c, --config <path>', 'Path to the configuration file', 'lupa.config.ts')
  .allowUnknownOption()
  .action(async (options) => {
    try {
      // 1. Process arguments for the test runner.
      // We take everything after the 'test' command keyword.
      const testIndex = process.argv.indexOf('test')
      const runnerArgs = testIndex !== -1 ? process.argv.slice(testIndex + 1) : []
      processCLIArgs(runnerArgs)

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
        process.exit(1)
      }

      // 3. Configure and execute tests
      configure(config)
      await run()
    } catch (err) {
      renderCriticalError('E_TEST_RUN_FAILED', 'Failed to execute test run.', err)
      process.exit(1)
    }
  })
