/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@poppinss/string'
import { ErrorsPrinter } from '@japa/errors-printer'

import { inspect } from 'node:util'
import { colors } from '../runner/helpers.js'
import type { Emitter } from '../testing/emitter.js'
import type { Runner } from '../runner/runner.js'

import type {
  TestEndNode,
  SuiteEndNode,
  GroupEndNode,
  TestStartNode,
  RunnerSummary,
  RunnerEndNode,
  GroupStartNode,
  SuiteStartNode,
  RunnerStartNode,
  RunnerListNode,
  BaseReporterOptions,
  RunnerEvents,
  WithCorrelation,
  CorrelationIds,
  FileEndNode,
  FileStartNode,
} from '../types.js'
import type { NormalizedConfig } from '../runner/types.js'

export type {
  TestEndNode,
  SuiteEndNode,
  GroupEndNode,
  TestStartNode,
  RunnerSummary,
  RunnerEndNode,
  GroupStartNode,
  SuiteStartNode,
  RunnerStartNode,
  RunnerListNode,
  BaseReporterOptions,
} from '../types.js'

/**
 * Abstract BaseReporter class serving as the foundation for creating custom test reporters in Lupa.
 *
 * It handles the boilerplate of connecting to the event emitter, tracking current execution state
 * (suite, group, file), and provides a set of empty lifecycle methods designed to be overridden.
 * It also includes utilities for formatting the summary, aggregating errors, and rendering
 * beautifully styled error stacks and test results.
 *
 * @example
 * ```ts
 * export class MyCustomReporter extends BaseReporter {
 *   protected onTestEnd(payload: TestEndNode) {
 *     if (payload.hasError) {
 *       console.log(`Failed: ${payload.title}`)
 *     } else {
 *       console.log(`Passed: ${payload.title}`)
 *     }
 *   }
 * }
 * ```
 */
export abstract class BaseReporter {
  runner?: Runner
  config?: NormalizedConfig

  protected options: BaseReporterOptions

  constructor(options: BaseReporterOptions = {}) {
    this.options = Object.assign({ stackLinesCount: 2 }, options)
  }

  /**
   * Returns the runner instance
   *
   * @throws Error if the runner is not initialized
   */
  protected getRunnerOrThrow(): Runner {
    if (!this.runner) {
      throw new Error('Invalid state: Runner not initialized')
    }

    return this.runner
  }

  /**
   * Pretty prints the aggregates
   */
  protected printAggregates(summary: RunnerSummary) {
    const tests: string[] = []
    const browserCount = this.runner?.poolManager?.browserNames.length || 1

    const passed = Math.round(summary.aggregates.passed / browserCount)
    const failed = Math.round(summary.aggregates.failed / browserCount)
    const todo = Math.round(summary.aggregates.todo / browserCount)
    const skipped = Math.round(summary.aggregates.skipped / browserCount)
    const regression = Math.round(summary.aggregates.regression / browserCount)
    const total = Math.round(summary.aggregates.total / browserCount)

    /**
     * Set value for tests row
     */
    if (passed) {
      tests.push(colors.green(`${passed} passed`))
    }
    if (failed) {
      tests.push(colors.red(`${failed} failed`))
    }
    if (todo) {
      tests.push(colors.cyan(`${todo} todo`))
    }
    if (skipped) {
      tests.push(colors.yellow(`${skipped} skipped`))
    }
    if (regression) {
      tests.push(colors.magenta(`${regression} regression`))
    }

    this.getRunnerOrThrow().summaryBuilder.use(() => {
      return [
        {
          key: colors.dim('Tests'),
          value: `${tests.join(', ')} ${colors.dim(`(${total})`)}`,
        },
        {
          key: colors.dim('Time'),
          value: colors.dim(string.milliseconds.format(summary.duration)),
        },
      ]
    })

    console.log(this.getRunnerOrThrow().summaryBuilder.build().join('\n'))
  }

  /**
   * Check if running with multiple browsers
   */
  protected isMultipleBrowsers(): boolean {
    return (this.runner?.poolManager?.browserNames.length ?? 0) > 1
  }

  /**
   * Get formatted browser name from browser ID
   */
  protected getBrowserName(browserId?: string): string | undefined {
    if (!browserId) {
      return undefined
    }

    let rawBrowserName: string | undefined = undefined
    const poolManager = this.runner?.poolManager
    if (poolManager) {
      const chunk = poolManager.getChunk(browserId)
      if (chunk) {
        rawBrowserName = chunk.browserName
      }
    }

    if (!rawBrowserName) {
      for (const name of ['chromium', 'firefox', 'webkit']) {
        if (browserId.startsWith(name)) {
          rawBrowserName = name
          break
        }
      }
    }

    if (!rawBrowserName) {
      rawBrowserName = browserId
    }

    if (rawBrowserName === 'chromium') {
      return 'Chromium'
    }
    if (rawBrowserName === 'firefox') {
      return 'Firefox'
    }
    if (rawBrowserName === 'webkit') {
      return 'WebKit'
    }
    return rawBrowserName.charAt(0).toUpperCase() + rawBrowserName.slice(1)
  }

  /**
   * Aggregates errors tree to a flat array
   */
  protected aggregateErrors(summary: RunnerSummary) {
    const errorsList: { phase: string; title: string; error: Error }[] = []
    const isMultiBrowser = this.isMultipleBrowsers()

    summary.failureTree.forEach((suite) => {
      const suiteBrowser = isMultiBrowser ? this.getBrowserName(suite.browserId) : undefined
      const suiteSuffix = suiteBrowser ? `: Failed on ${suiteBrowser}` : ''

      suite.errors.forEach((error) => errorsList.push({ title: `${suite.name}${suiteSuffix}`, ...error }))

      suite.children.forEach((testOrGroup) => {
        /**
         * Suite child is a test
         */
        if (testOrGroup.type === 'test') {
          const testBrowser = isMultiBrowser ? this.getBrowserName(testOrGroup.browserId) : undefined
          const testSuffix = testBrowser ? `: Failed on ${testBrowser}` : ''

          testOrGroup.errors.forEach((error) => {
            errorsList.push({ title: `${suite.name} / ${testOrGroup.title}${testSuffix}`, ...error })
          })
          return
        }

        /**
         * Suite child is a group
         */
        const groupBrowser = isMultiBrowser ? this.getBrowserName(testOrGroup.browserId) : undefined
        const groupSuffix = groupBrowser ? `: Failed on ${groupBrowser}` : ''

        testOrGroup.errors.forEach((error) => {
          errorsList.push({ title: `${testOrGroup.name}${groupSuffix}`, ...error })
        })
        testOrGroup.children.forEach((test) => {
          const testBrowser = isMultiBrowser ? this.getBrowserName(test.browserId) : undefined
          const testSuffix = testBrowser ? `: Failed on ${testBrowser}` : ''

          test.errors.forEach((error) => {
            errorsList.push({ title: `${testOrGroup.name} / ${test.title}${testSuffix}`, ...error })
          })
        })
      })
    })
    return errorsList
  }

  /**
   * Pretty print errors
   */
  protected async printErrors(summary: RunnerSummary) {
    if (!summary.failureTree.length) {
      return
    }

    const errorPrinter = new ErrorsPrinter({
      framesMaxLimit: this.options.framesMaxLimit,
    })

    errorPrinter.printSectionHeader('ERRORS')
    await errorPrinter.printErrors(this.aggregateErrors(summary))
  }

  /**
   * Pretty print import errors
   */
  protected async printImportErrors(summary: RunnerSummary) {
    if (!summary.importErrors?.length) {
      return
    }

    const errorPrinter = new ErrorsPrinter({
      framesMaxLimit: this.options.framesMaxLimit,
    })

    const isMultiBrowser = this.isMultipleBrowsers()

    errorPrinter.printSectionHeader('TEST FILE IMPORT ERRORS')
    await errorPrinter.printErrors(
      summary.importErrors.map((ie) => {
        const browser = isMultiBrowser ? this.getBrowserName(ie.browserId) : undefined
        const suffix = browser ? `: Failed on ${browser}` : ''
        return {
          title: `Cannot load test file: ${ie.file}${suffix}`,
          phase: 'import',
          error: ie.error,
        }
      })
    )
  }

  /**
   * Invoked when an individual test begins execution.
   *
   * @example
   * ```ts
   * protected onTestStart(node: WithCorrelation<TestStartNode>) {
   *   console.log(`Starting test: ${node.title}`)
   * }
   * ```
   * @param node The test start node
   */
  protected onTestStart?(node: WithCorrelation<TestStartNode>): void

  /**
   * Invoked when an individual test completes, regardless of success or failure.
   * You can inspect `node.hasError`, `node.isSkipped`, or `node.isTodo` to determine the outcome.
   *
   * @example
   * ```ts
   * protected onTestEnd(node: WithCorrelation<TestEndNode>) {
   *   const duration = String(node.duration).padStart(4, ' ')
   *   if (node.hasError) {
   *     console.log(`[FAILED] ${duration}ms - ${node.title}`)
   *   } else {
   *     console.log(`[PASSED] ${duration}ms - ${node.title}`)
   *   }
   * }
   * ```
   * @param node The test end node
   */
  protected onTestEnd?(node: WithCorrelation<TestEndNode>): void

  /**
   * Invoked when a test group (created via `test.group()`) begins execution.
   *
   * @example
   * ```ts
   * protected onGroupStart(node: WithCorrelation<GroupStartNode>) {
   *   console.log(`\n▶ Group: ${node.title}`)
   * }
   * ```
   * @param node The group start node
   */
  protected onGroupStart?(node: WithCorrelation<GroupStartNode>): void

  /**
   * Invoked when a test group completes execution.
   *
   * @example
   * ```ts
   * protected onGroupEnd(node: WithCorrelation<GroupEndNode>) {
   *   console.log(`End of group: ${node.title}`)
   * }
   * ```
   * @param node The group end node
   */
  protected onGroupEnd?(node: WithCorrelation<GroupEndNode>): void

  /**
   * Invoked when a test suite begins execution.
   *
   * @example
   * ```ts
   * protected onSuiteStart(node: WithCorrelation<SuiteStartNode>) {
   *   console.log(`\n=== Suite: ${node.name} ===`)
   * }
   * ```
   * @param node The suite start node
   */
  protected onSuiteStart?(node: WithCorrelation<SuiteStartNode>): void

  /**
   * Invoked when a test suite completes execution.
   *
   * @example
   * ```ts
   * protected onSuiteEnd(node: WithCorrelation<SuiteEndNode>) {
   *   if (node.hasError) {
   *     console.log(`Suite ${node.name} encountered errors.`)
   *   }
   * }
   * ```
   * @param node The suite end node
   */
  protected onSuiteEnd?(node: WithCorrelation<SuiteEndNode>): void

  /**
   * Invoked once when the entire runner initiates execution.
   * Useful for setting up initial console outputs, tracking start times, or initializing external services.
   *
   * @example
   * ```ts
   * protected async start(node: RunnerStartNode & Partial<CorrelationIds>) {
   *   console.clear()
   *   console.log('Test run started...')
   * }
   * ```
   * @param node The runner start node
   */
  protected start?(node: RunnerStartNode & Partial<CorrelationIds>): Promise<void> | void

  /**
   * Invoked once when the runner completely finishes execution.
   * This is the ideal place to invoke `this.printSummary()` or finalize external telemetry connections.
   *
   * @example
   * ```ts
   * protected async end(node: RunnerEndNode) {
   *   const summary = this.getRunnerOrThrow().getSummary()
   *   await this.printSummary(summary)
   * }
   * ```
   * @param node The runner end node
   */
  protected end?(node: RunnerEndNode): Promise<void> | void

  /**
   * Invoked when the runner is in list mode and dumps the test tree.
   *
   * @example
   * ```ts
   * protected onRunnerList(node: RunnerListNode) {
   *   console.log(`Runner list: ${node.tree.size}`)
   * }
   * ```
   * @param node The runner list node
   */
  protected onRunnerList?(node: RunnerListNode): void

  /**
   * Invoked when an import error happens.
   *
   * @example
   * ```ts
   * protected onImportError(node: RunnerEvents['runner:import_error']) {
   *   console.log(`Import Error: ${node.file}`)
   * }
   * ```
   * @param node The import error node
   */
  protected onImportError?(node: RunnerEvents['runner:import_error']): void

  /**
   * Invoked when a test file starts being processed.
   *
   * @example
   * ```ts
   * protected onFileStart(node: WithCorrelation<FileStartNode>) {
   *   console.log(`Processing file: ${node.file}`)
   * }
   * ```
   * @param node The file start node
   */
  protected onFileStart?(node: WithCorrelation<FileStartNode>): void

  /**
   * Invoked when a test file finished all tests execution.
   *
   * @example
   * ```ts
   * protected onFileEnd(node: WithCorrelation<FileEndNode>) {
   *   console.log(`Finished processing file: ${node.file}`)
   * }
   * ```
   * @param node The file end node
   */
  protected onFileEnd?(node: WithCorrelation<FileEndNode>): void

  /**
   * Print tests summary
   */
  protected async printSummary(summary: RunnerSummary) {
    await this.printImportErrors(summary)
    await this.printErrors(summary)

    console.log('')
    if (summary.aggregates.total === 0 && !summary.hasError) {
      console.log(colors.bgYellow().black(' NO TESTS EXECUTED '))
      return
    }

    if (summary.hasError) {
      console.log(colors.bgRed().black(' FAILED '))
    } else {
      console.log(colors.bgGreen().black(' PASSED '))
    }
    console.log('')
    this.printAggregates(summary)
  }

  /**
   * Invoked by the tests runner when tests are about to start
   */
  boot(runner: Runner, emitter: Emitter<RunnerEvents>, config: NormalizedConfig) {
    this.runner = runner
    this.config = config

    emitter.on('test:start', (payload) => {
      if (this.onTestStart) {
        this.onTestStart(payload)
      }
    })

    emitter.on('test:end', (payload) => {
      if (this.onTestEnd) {
        this.onTestEnd(payload)
      }
    })

    emitter.on('group:start', (payload) => {
      if (this.onGroupStart) {
        this.onGroupStart(payload)
      }
    })

    emitter.on('group:end', (payload) => {
      if (this.onGroupEnd) {
        this.onGroupEnd(payload)
      }
    })

    emitter.on('suite:start', (payload) => {
      if (this.onSuiteStart) {
        this.onSuiteStart(payload)
      }
    })

    emitter.on('suite:end', (payload) => {
      if (this.onSuiteEnd) {
        this.onSuiteEnd(payload)
      }
    })

    emitter.on('runner:start', async (payload) => {
      if (this.start) {
        await this.start(payload)
      }
    })

    emitter.on('runner:end', async (payload) => {
      if (this.end) {
        await this.end(payload)
      }
    })

    emitter.on('runner:list', (payload) => {
      if (this.onRunnerList) {
        this.onRunnerList(payload)
      }
    })

    emitter.on('runner:import_error', (payload) => {
      if (this.onImportError) {
        this.onImportError(payload)
      }
    })

    emitter.on('browser:log', (payload) => {
      this.onBrowserLog(payload as RunnerEvents['browser:log'])
    })

    emitter.on('file:start', (payload) => {
      if (this.onFileStart) {
        this.onFileStart(payload)
      }
    })

    emitter.on('file:end', (payload) => {
      if (this.onFileEnd) {
        this.onFileEnd(payload)
      }
    })
  }

  /**
   * Invoked when the browser runner emits a console log event during test execution.
   * This allows the reporter to capture and render runtime browser logs.
   *
   * @example
   * ```ts
   * protected onBrowserLog(payload: RunnerEvents['browser:log']) {
   *   if (payload.type === 'error') {
   *     console.error(`[BROWSER ERROR in ${payload.file}]`, ...payload.messages)
   *   }
   * }
   * ```
   */
  protected onBrowserLog(payload: RunnerEvents['browser:log']) {
    const { file, type, messages } = payload

    const isMultiline = messages.some((v) => {
      if (typeof v !== 'string') return false
      return v.includes('\n')
    })

    const messagePrefix = colors.yellow(`[Browser Console - ${file}]`)

    if (type === 'table') {
      console.log(messagePrefix)
      console.table(...messages)
      return
    }

    if (type === 'dir' || type === 'dirxml') {
      console.log(messagePrefix)
      console.dir(...messages)
      return
    }

    type ValidType = Exclude<typeof type, 'table' | 'dir' | 'dirxml'>
    const prefixes: Record<ValidType, (message: string, ...args: any[]) => void> = {
      error: console.error,
      warning: console.warn,
      info: console.info,
      log: console.log,
      debug: console.debug,
      startGroup: console.group,
      startGroupCollapsed: console.groupCollapsed,
      assert: console.log,
      profile: console.profile,
      profileEnd: console.profileEnd,
      trace: console.log,
      timeEnd: console.log,
      count: console.log,
    }

    let formatted: any[]
    if (['table'].includes(type)) {
      formatted = messages
    } else {
      formatted = messages.map((a) => (typeof a === 'string' ? a : inspect(a, { colors: true, depth: null })))
    }

    if (isMultiline) {
      prefixes[type as ValidType](messagePrefix, '\n', ...formatted)
    } else {
      prefixes[type as ValidType](messagePrefix, ...formatted)
    }
  }
}
