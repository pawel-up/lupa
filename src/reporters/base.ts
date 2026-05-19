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

  /**
   * Path to the file for which the tests are getting executed
   */
  currentFileName?: string

  /**
   * Suite for which the tests are getting executed
   */
  currentSuiteName?: string

  /**
   * Group for which the tests are getting executed
   */
  currentGroupName?: string

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

    /**
     * Set value for tests row
     */
    if (summary.aggregates.passed) {
      tests.push(colors.green(`${summary.aggregates.passed} passed`))
    }
    if (summary.aggregates.failed) {
      tests.push(colors.red(`${summary.aggregates.failed} failed`))
    }
    if (summary.aggregates.todo) {
      tests.push(colors.cyan(`${summary.aggregates.todo} todo`))
    }
    if (summary.aggregates.skipped) {
      tests.push(colors.yellow(`${summary.aggregates.skipped} skipped`))
    }
    if (summary.aggregates.regression) {
      tests.push(colors.magenta(`${summary.aggregates.regression} regression`))
    }

    this.getRunnerOrThrow().summaryBuilder.use(() => {
      return [
        {
          key: colors.dim('Tests'),
          value: `${tests.join(', ')} ${colors.dim(`(${summary.aggregates.total})`)}`,
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
   * Aggregates errors tree to a flat array
   */
  protected aggregateErrors(summary: RunnerSummary) {
    const errorsList: { phase: string; title: string; error: Error }[] = []

    summary.failureTree.forEach((suite) => {
      suite.errors.forEach((error) => errorsList.push({ title: suite.name, ...error }))

      suite.children.forEach((testOrGroup) => {
        /**
         * Suite child is a test
         */
        if (testOrGroup.type === 'test') {
          testOrGroup.errors.forEach((error) => {
            errorsList.push({ title: `${suite.name} / ${testOrGroup.title}`, ...error })
          })
          return
        }

        /**
         * Suite child is a group
         */
        testOrGroup.errors.forEach((error) => {
          errorsList.push({ title: testOrGroup.name, ...error })
        })
        testOrGroup.children.forEach((test) => {
          test.errors.forEach((error) => {
            errorsList.push({ title: `${testOrGroup.name} / ${test.title}`, ...error })
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

    errorPrinter.printSectionHeader('TEST FILE IMPORT ERRORS')
    await errorPrinter.printErrors(
      summary.importErrors.map((ie) => ({
        title: `Cannot load test file: ${ie.file}`,
        phase: 'import',
        error: ie.error,
      }))
    )
  }

  /**
   * Invoked when an individual test begins execution.
   *
   * @example
   * ```ts
   * protected onTestStart(node: TestStartNode) {
   *   console.log(`Starting test: ${node.title}`)
   * }
   * ```
   */
  protected onTestStart?(node: TestStartNode): void

  /**
   * Invoked when an individual test completes, regardless of success or failure.
   * You can inspect `node.hasError`, `node.isSkipped`, or `node.isTodo` to determine the outcome.
   *
   * @example
   * ```ts
   * protected onTestEnd(node: TestEndNode) {
   *   const duration = String(node.duration).padStart(4, ' ')
   *   if (node.hasError) {
   *     console.log(`[FAILED] ${duration}ms - ${node.title}`)
   *   } else {
   *     console.log(`[PASSED] ${duration}ms - ${node.title}`)
   *   }
   * }
   * ```
   */
  protected onTestEnd?(node: TestEndNode): void

  /**
   * Invoked when a test group (created via `test.group()`) begins execution.
   *
   * @example
   * ```ts
   * protected onGroupStart(node: GroupStartNode) {
   *   console.log(`\n▶ Group: ${node.title}`)
   * }
   * ```
   */
  protected onGroupStart?(node: GroupStartNode): void

  /**
   * Invoked when a test group completes execution.
   *
   * @example
   * ```ts
   * protected onGroupEnd(node: GroupEndNode) {
   *   console.log(`End of group: ${node.title}`)
   * }
   * ```
   */
  protected onGroupEnd?(node: GroupEndNode): void

  /**
   * Invoked when a test suite begins execution.
   *
   * @example
   * ```ts
   * protected onSuiteStart(node: SuiteStartNode) {
   *   console.log(`\n=== Suite: ${node.name} ===`)
   * }
   * ```
   */
  protected onSuiteStart?(node: SuiteStartNode): void

  /**
   * Invoked when a test suite completes execution.
   *
   * @example
   * ```ts
   * protected onSuiteEnd(node: SuiteEndNode) {
   *   if (node.hasError) {
   *     console.log(`Suite ${node.name} encountered errors.`)
   *   }
   * }
   * ```
   */
  protected onSuiteEnd?(node: SuiteEndNode): void

  /**
   * Invoked once when the entire runner initiates execution.
   * Useful for setting up initial console outputs, tracking start times, or initializing external services.
   *
   * @example
   * ```ts
   * protected async start(node: RunnerStartNode) {
   *   console.clear()
   *   console.log('Test run started...')
   * }
   * ```
   */
  protected start?(node: RunnerStartNode): Promise<void> | void

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
   */
  protected end?(node: RunnerEndNode): Promise<void> | void

  /**
   * Invoked when the runner is in list mode and dumps the test tree.
   */
  protected onRunnerList?(node: RunnerListNode): void

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
      this.currentFileName = payload.meta?.fileName
      if (this.onTestStart) {
        this.onTestStart(payload as unknown as TestStartNode)
      }
    })

    emitter.on('test:end', (payload) => {
      if (this.onTestEnd) {
        this.onTestEnd(payload as unknown as TestEndNode)
      }
    })

    emitter.on('group:start', (payload) => {
      this.currentGroupName = payload.title
      this.currentFileName = payload.meta?.fileName
      if (this.onGroupStart) {
        this.onGroupStart(payload as unknown as GroupStartNode)
      }
    })

    emitter.on('group:end', (payload) => {
      this.currentGroupName = undefined
      if (this.onGroupEnd) {
        this.onGroupEnd(payload as unknown as GroupEndNode)
      }
    })

    emitter.on('suite:start', (payload) => {
      this.currentSuiteName = payload.name
      if (this.onSuiteStart) {
        this.onSuiteStart(payload as unknown as SuiteStartNode)
      }
    })

    emitter.on('suite:end', (payload) => {
      this.currentSuiteName = undefined
      if (this.onSuiteEnd) {
        this.onSuiteEnd(payload as unknown as SuiteEndNode)
      }
    })

    emitter.on('runner:start', async (payload) => {
      if (this.start) {
        await this.start(payload as unknown as RunnerStartNode)
      }
    })

    emitter.on('runner:end', async (payload) => {
      if (this.end) {
        await this.end(payload as unknown as RunnerEndNode)
      }
    })

    emitter.on('runner:list', (payload) => {
      if (this.onRunnerList) {
        this.onRunnerList(payload as unknown as RunnerListNode)
      }
    })

    emitter.on('browser:log', (payload) => {
      this.onBrowserLog(payload as RunnerEvents['browser:log'])
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
