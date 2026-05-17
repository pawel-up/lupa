import Macroable from '@poppinss/macroable'

import debug from './debug.js'
import { type Suite } from './suite/main.js'
import { type Emitter } from './emitter.js'
import { Group } from './group/main.js'

/**
 * The WebRunner class exposes the API to register test suites and execute
 * them sequentially in the browser.
 */
export class WebRunner extends Macroable {
  #emitter: Emitter
  #failed = false
  #bail = false

  /**
   * Callbacks to invoke on every suite
   */
  #configureSuiteCallbacks: ((suite: Suite) => void)[] = []

  /**
   * A collection of suites
   */
  suites: Suite[] = []

  /**
   * Constructor
   *
   * @param emitter - Emitter to use
   */
  constructor(emitter: Emitter) {
    super()
    this.#emitter = emitter
  }

  /**
   * Notify the reporter about the runner start
   */
  #notifyStart() {
    return this.#emitter.emit('runner:start', { estimatedTotalFiles: 0 })
  }

  /**
   * Notify the reporter about the runner end
   */
  #notifyEnd() {
    return this.#emitter.emit('runner:end', {
      hasError: this.#failed,
    })
  }

  /**
   * Know if one or more suites have failed
   */
  get failed(): boolean {
    return this.#failed
  }

  /**
   * Add a suite to the runner
   *
   * @param suite - Suite to add
   * @returns This runner instance
   */
  add(suite: Suite): this {
    this.#configureSuiteCallbacks.forEach((callback) => callback(suite))
    this.suites.push(suite)
    debug('registering suite %s', suite.name)
    return this
  }

  /**
   * Tap into each suite and configure it
   *
   * @param callback - Callback to configure each suite
   * @returns This runner instance
   */
  onSuite(callback: (suite: Suite) => void): this {
    this.suites.forEach((suite) => callback(suite))
    this.#configureSuiteCallbacks.push(callback)
    return this
  }

  /**
   * Enable/disable the bail mode. In bail mode, all
   * upcoming suites/groups/tests will be skipped
   * when the current test fails
   *
   * @param toggle - Whether to enable or disable bail mode
   * @returns This runner instance
   */
  bail(toggle = true): this {
    this.#bail = toggle
    this.onSuite((suite) => suite.bail(toggle))
    return this
  }

  /**
   * Start the test runner process. The method emits
   * "runner:start" event
   *
   * @returns Promise that resolves when the runner starts
   */
  async start(): Promise<void> {
    debug('starting to run tests')
    await this.#notifyStart()
  }

  /**
   * Execute runner suites
   *
   * @returns Promise that resolves when the runner finishes
   */
  async exec(): Promise<void> {
    const pinnedTests: { title: string; stack: string }[] = []

    for (const suite of this.suites) {
      // Collect pinned tests
      suite.stack.forEach((groupOrTest) => {
        if (groupOrTest instanceof Group) {
          groupOrTest.tests.forEach(($test) => {
            if ($test.isPinned) {
              try {
                $test.options.meta.abort?.('Finding pinned test location')
              } catch (e: any) {
                pinnedTests.push({ title: $test.title, stack: e.stack })
              }
            }
          })
        } else if (groupOrTest.isPinned) {
          try {
            groupOrTest.options.meta.abort?.('Finding pinned test location')
          } catch (e: any) {
            pinnedTests.push({ title: groupOrTest.title, stack: e.stack })
          }
        }
      })
    }

    if (pinnedTests.length > 0) {
      this.#emitter.emit('runner:pinned_tests', { tests: pinnedTests })
    }

    if (typeof window !== 'undefined' && window.__lupa__?.config?.list) {
      const listPayload = {
        suites: this.suites.map((suite) => {
          const mapTest = (t: any) => ({
            title: t.title,
            tags: t.options.tags || [],
            timeout: t.options.timeout,
            retries: t.options.retries,
            isSkipped: !!t.options.isSkipped,
            isTodo: !!t.options.isTodo,
            meta: t.options.meta,
          })

          const tests = []
          const groups = []

          for (const item of suite.stack) {
            if (item instanceof Group) {
              groups.push({
                title: item.title,
                tests: item.tests.map(mapTest),
                groups: [], // nested groups not supported
              })
            } else {
              tests.push(mapTest(item))
            }
          }

          return {
            name: suite.name,
            groups,
            tests,
          }
        }),
      }

      await this.#emitter.emit('runner:list', listPayload)
      return
    }

    for (const suite of this.suites) {
      /**
       * Skip tests in bail mode when there is an error
       */
      if (this.#bail && this.#failed) {
        suite.stack.forEach((groupOrTest) => {
          if (groupOrTest instanceof Group) {
            groupOrTest.tap((t) => t.skip(true, 'Skipped due to bail mode'))
          } else {
            groupOrTest.skip(true, 'Skipped due to bail mode')
          }
        })
      }

      await suite.exec()
      if (!this.#failed && suite.failed) {
        this.#failed = true
      }
    }
  }

  /**
   * End the runner process. Emits "runner:end" event
   */
  async end() {
    await this.#notifyEnd()
  }
}
