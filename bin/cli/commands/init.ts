import { Command } from 'commander'
import { input, confirm, checkbox } from '@inquirer/prompts'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import supportsColor from 'supports-color'
import useColors from '@poppinss/colors'
import { reporterNames } from '../../../src/reporters/index.js'
import { renderCancelled, renderCriticalError } from '../errors.js'

const colors = supportsColor.stdout ? useColors.ansi() : useColors.silent()

function getTemplateWithSuites(reportersList: string[], suitesList: string[], isTS: boolean) {
  const reps = reportersList.map((r) => `reporters.${r}()`).join(', ')
  const repsArr = reportersList.map((r) => `'${r}'`).join(', ')
  const ext = isTS ? 'ts' : 'js'

  const suitesStr = suitesList
    .map(
      (s) => `    {
      name: '${s}',
      files: ['{TESTS_LOCATION}/${s}/**/*.test.${ext}', '{TESTS_LOCATION}/${s}/**/*.spec.${ext}'],
    }`
    )
    .join(',\n')

  const imports =
    `import { defineConfig } from '@pawel-up/lupa/runner'\nimport reporters from '@pawel-up/lupa/reporters'` +
    (isTS
      ? `\nimport type { Assert } from '@pawel-up/lupa/assert'\nimport type { Network } from '@pawel-up/lupa/network'`
      : '')

  const declarations = isTS
    ? `\n\ndeclare module '@pawel-up/lupa/testing' {
  interface TestContext {
    assert: Assert
    network: Network
  }
}`
    : ''

  return `${imports}

export default defineConfig({
  testPlugins: ['@pawel-up/lupa/assert', '@pawel-up/lupa/network'],
  reporters: {
    activated: [${repsArr}],
    list: [${reps}],
  },
  suites: [
${suitesStr}
  ],
})${declarations}`
}

function getTemplateWithoutSuites(reportersList: string[], isTS: boolean) {
  const reps = reportersList.map((r) => `reporters.${r}()`).join(', ')
  const repsArr = reportersList.map((r) => `'${r}'`).join(', ')
  const ext = isTS ? 'ts' : 'js'

  const imports =
    `import { defineConfig } from '@pawel-up/lupa/runner'\nimport reporters from '@pawel-up/lupa/reporters'` +
    (isTS
      ? `\nimport type { Assert } from '@pawel-up/lupa/assert'\nimport type { Network } from '@pawel-up/lupa/network'`
      : '')

  const declarations = isTS
    ? `\n\ndeclare module '@pawel-up/lupa/testing' {
  interface TestContext {
    assert: Assert
    network: Network
  }
}`
    : ''

  return `${imports}

export default defineConfig({
  files: ['{TESTS_LOCATION}/**/*.test.${ext}', '{TESTS_LOCATION}/**/*.spec.${ext}'],
  testPlugins: ['@pawel-up/lupa/assert', '@pawel-up/lupa/network'],
  reporters: {
    activated: [${repsArr}],
    list: [${reps}],
  },
})${declarations}`
}

function getTestTemplate(isTS: boolean) {
  const ext = isTS ? 'ts' : 'js'
  return `import { test } from '@pawel-up/lupa/testing'

test.group('Example Group', () => {
  test('example.spec.${ext}', async ({ assert }) => {
    assert.ok(true)
  })
})`
}

class InitCommand {
  isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY)
  cwd = process.cwd()
  options: any
  shouldBackupConfig = false
  isTS = true
  configPath?: string
  testDir?: string
  suites: string[] = []
  reporters: string[] = []
  constructor(options: any) {
    if (!this.isInteractive && (!options.config || !options.testDir || !options.suites || !options.reporters)) {
      renderCriticalError(
        'E_INIT_NON_INTERACTIVE',
        'In non-interactive mode, --config, --test-dir, --suites, and --reporters must be provided.'
      )
    }
    this.options = options
  }

  async run() {
    const { options } = this
    const configInput = options.config
    const testDirInput = options.testDir
    const suitesInput = options.suites ? options.suites.split(',').map((s: string) => s.trim()) : undefined
    const reportersInput = options.reporters ? options.reporters.split(',').map((s: string) => s.trim()) : undefined

    // 0. Language
    await this.setupLanguage(options.ts, options.js)
    // 1. Config path
    await this.setupConfigPath(configInput)
    // 2. Test directory
    await this.setupTestDirectory(testDirInput)
    // 3. Suites
    await this.setupSuites(suitesInput)
    // 4. Reporters
    await this.setupReporters(reportersInput)
    // 5. Summary
    this.renderSummary()

    if (!options.yes && this.isInteractive) {
      const proceed = await confirm({ message: 'Does this look good?', default: true })
      if (!proceed) {
        renderCancelled()
      }
    }

    // 6. Create files
    await this.createFiles()
  }

  private async setupLanguage(ts?: boolean, js?: boolean): Promise<void> {
    if (ts !== undefined || js !== undefined) {
      this.isTS = ts === true || js === false
    } else if (this.isInteractive) {
      const hasTsConfig = existsSync(path.join(this.cwd, 'tsconfig.json'))
      this.isTS = await confirm({ message: 'Are you using TypeScript?', default: hasTsConfig })
    } else {
      const hasTsConfig = existsSync(path.join(this.cwd, 'tsconfig.json'))
      this.isTS = hasTsConfig
    }
  }

  private async setupConfigPath(configInput?: string): Promise<void> {
    if (!configInput) {
      await this.initializeConfigPath()
    } else {
      await this.checkConfigPath(configInput)
    }
  }

  private async initializeConfigPath(): Promise<void> {
    const ext = this.isTS ? 'ts' : 'js'
    const defaultName = `lupa.config.${ext}`
    if (existsSync(path.join(this.cwd, defaultName))) {
      const overwrite = await confirm({ message: `File ${defaultName} already exists. Overwrite?`, default: false })
      if (overwrite) {
        this.configPath = defaultName
        this.shouldBackupConfig = true
      } else {
        this.configPath = await input({
          message: 'Enter new path for test config file:',
          default: `lupa.config.${ext}`,
        })
      }
    } else {
      this.configPath = await input({ message: 'Path to the test configuration file:', default: defaultName })
    }
  }

  private async checkConfigPath(currentPath: string): Promise<void> {
    const exists = existsSync(path.join(this.cwd, currentPath))
    if (exists && !this.options.yes) {
      if (this.isInteractive) {
        const overwrite = await confirm({
          message: `File ${currentPath} already exists. Overwrite?`,
          default: false,
        })
        if (overwrite) {
          this.shouldBackupConfig = true
        } else {
          renderCancelled()
        }
      } else {
        renderCriticalError('E_FILE_EXISTS', `File ${currentPath} already exists. Use --yes to overwrite.`)
      }
    } else if (exists && this.options.yes) {
      this.shouldBackupConfig = true
    }

    this.configPath = currentPath
  }

  private async setupTestDirectory(testDirInput?: string): Promise<void> {
    if (!testDirInput) {
      let defaultDir = './tests'
      if (existsSync(path.join(this.cwd, 'test'))) {
        defaultDir = './test'
      }
      this.testDir = await input({ message: 'Directory for test files:', default: defaultDir })
    } else {
      this.testDir = testDirInput
    }
  }

  private async setupSuites(suitesInput?: string[]): Promise<void> {
    if (!suitesInput) {
      await this.initializeSuites()
    } else if (suitesInput.length === 1 && (suitesInput[0] === 'none' || suitesInput[0] === '')) {
      this.suites = []
    } else if (suitesInput.length === 1 && suitesInput[0] === 'all') {
      this.suites = ['unit', 'functional', 'e2e', 'integration']
    } else {
      this.suites = suitesInput
    }
  }

  private async initializeSuites(): Promise<void> {
    const wantSuites = await confirm({
      message: 'Do you want to create test suites (e.g. unit, e2e)?',
      default: true,
    })
    if (wantSuites) {
      this.suites = await checkbox({
        message: 'Select test suites to create:',
        choices: [
          { name: 'unit', value: 'unit', checked: true },
          { name: 'functional', value: 'functional' },
          { name: 'e2e', value: 'e2e' },
          { name: 'integration', value: 'integration' },
        ],
      })
    } else {
      this.suites = []
    }
  }

  private async setupReporters(reportersInput?: string[]): Promise<void> {
    if (!reportersInput) {
      await this.initializeReporters()
    } else {
      this.reporters = reportersInput
    }

    await this.validateReporters(this.reporters)
  }

  private async initializeReporters(): Promise<void> {
    this.reporters = await checkbox({
      message: 'Select reporters to use:',
      choices: reporterNames.map((name) => ({ name, value: name, checked: name === 'progress' })),
    })
  }

  private async validateReporters(reporters: string[]): Promise<void> {
    if (reporters.length === 0) {
      renderCriticalError('E_NO_REPORTER', 'At least one reporter must be selected.')
    }
    const notExistingReporters = reporters.filter(
      (reporter) => !reporterNames.includes(reporter as (typeof reporterNames)[number])
    )
    if (notExistingReporters.length > 0) {
      renderCriticalError(
        'E_UNKNOWN_REPORTER',
        `Unknown reporters: ${notExistingReporters.join(', ')}. Available reporters: ${reporterNames.join(', ')}`
      )
    }
  }

  private renderSummary(): void {
    console.log(colors.cyan('\nConfiguration Summary:'))
    console.log(`  Language:    ${colors.yellow(this.isTS ? 'TypeScript' : 'JavaScript')}`)
    console.log(`  Config File: ${colors.yellow(this.configPath || 'not set')}`)
    console.log(`  Test Dir:    ${colors.yellow(this.testDir || 'not set')}`)
    console.log(`  Suites:      ${colors.yellow(this.suites.length > 0 ? this.suites.join(', ') : 'None')}`)
    console.log(`  Reporters:   ${colors.yellow(this.reporters.join(', '))}`)
  }

  private async createFiles(): Promise<void> {
    const { cwd, testDir, suites, reporters, shouldBackupConfig, configPath } = this

    // This check is here just for safety, it should never happen
    if (!configPath || !testDir) {
      renderCriticalError('E_MISSING_DATA', 'Configuration path or test directory is not set.')
    }

    const testLocFixed = testDir.replace(/^\.\//, '')
    let template =
      suites.length > 0
        ? getTemplateWithSuites(reporters, suites, this.isTS)
        : getTemplateWithoutSuites(reporters, this.isTS)
    template = template.replaceAll('{TESTS_LOCATION}', testLocFixed)

    try {
      if (shouldBackupConfig) {
        await fs.copyFile(path.join(cwd, configPath), path.join(cwd, `${configPath}.bak`))
      }

      await fs.mkdir(path.dirname(path.join(cwd, configPath)), { recursive: true })
      await fs.writeFile(path.join(cwd, configPath), template)

      // Generate Test Directories & Dummy Files
      const ext = this.isTS ? 'ts' : 'js'
      const tTemplate = getTestTemplate(this.isTS)

      if (suites.length > 0) {
        for (const suite of suites) {
          const suiteDir = path.join(cwd, testDir, suite)
          await fs.mkdir(suiteDir, { recursive: true })
          await fs.writeFile(path.join(suiteDir, `example.spec.${ext}`), tTemplate)
        }
      } else {
        const tDir = path.join(cwd, testDir)
        await fs.mkdir(tDir, { recursive: true })
        await fs.writeFile(path.join(tDir, `example.spec.${ext}`), tTemplate)
      }

      console.log(colors.green('\n✓ Successfully initialized Lupa configuration!'))
    } catch (err) {
      renderCriticalError('E_INIT_FAILED', 'Failed to create configuration files:', err)
    }
  }
}

export const initCommand = new Command('init')
  .description('Initializes lupa configuration files in the current directory')
  .option('--config <path>', 'Path to the test configuration file')
  .option('--ts', 'Use TypeScript configuration and templates')
  .option('--js', 'Use JavaScript configuration and templates')
  .option('--test-dir <path>', 'Directory where test files will be located')
  .option('--suites <names>', 'Comma separated list of suite names (e.g. unit,functional), or "all", or "none"')
  .option('--reporters <names>', 'Comma separated list of reporters to use')
  .option('-y, --yes', 'Overwrite existing files and skip confirmation')
  .action(async (options) => {
    const initCmd = new InitCommand(options)
    await initCmd.run()
  })
