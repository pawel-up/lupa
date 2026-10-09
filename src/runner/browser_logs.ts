import type { ConsoleMessage, JSHandle, Page } from 'playwright'
import type { Emitter } from '../testing/emitter.js'
import type { RunnerEvents } from '../types.js'

/**
 * A class that specializes in collecting and processing browser logs.
 */
export class BrowserLogs {
  protected readonly page: Page

  /**
   * Path to the Lupa configuration file.
   */
  configPath?: string

  /**
   * When set, browser internal debug and network resource errors are also printed.
   */
  verbose = false

  /**
   * When set, all browser logs are suppressed.
   */
  silent = false

  /**
   * The list of prefixes to ignore messages containing.
   * @default ['[vite]']
   */
  ignorePrefix = ['[vite]']

  /**
   * Callback to emit logs to the reporter
   */
  emitter: Emitter<RunnerEvents>

  /**
   * Creates an instance of BrowserLogs.
   *
   * @param page - The Playwright page to capture logs from.
   * @param verbose - Whether to enable verbose mode including browser engine debug output.
   * @param emitter - The event emitter to dispatch browser logs to reporters.
   * @param configPath - Optional path to the configuration file.
   * @param silent - Whether to suppress all browser console messages.
   */
  constructor(page: Page, verbose = false, emitter: Emitter<RunnerEvents>, configPath?: string, silent = false) {
    this.page = page
    this.verbose = verbose
    this.emitter = emitter
    this.configPath = configPath
    this.silent = silent

    this.handleConsoleMessage = this.handleConsoleMessage.bind(this)
    this.handlePageError = this.handlePageError.bind(this)
  }

  /**
   * Starts capturing browser logs.
   */
  boot(): void {
    this.page.on('console', this.handleConsoleMessage)
    this.page.on('pageerror', this.handlePageError)
  }

  /**
   * Determines whether a console message should be displayed.
   *
   * @param message - The raw text of the console message.
   * @param type - The console message type (e.g. 'log', 'error', 'warn').
   * @param argsCount - Number of arguments passed to the console call. Browser engine
   *   internal network errors typically have 0 arguments, while user console.error calls have >= 1.
   * @returns Whether to emit the message to reporters.
   */
  protected canShow(message: string, type: string, argsCount = 0): boolean {
    if (this.silent) {
      return false
    }

    const trimmed = message.trim()

    // Under verbose mode, show everything except bundler internal messages
    if (this.verbose) {
      return !this.ignorePrefix.some((prefix) => trimmed.startsWith(prefix))
    }

    // Suppress bundler noise (e.g. Vite HMR messages)
    if (this.ignorePrefix.some((prefix) => trimmed.startsWith(prefix))) {
      return false
    }

    // Suppress browser engine resource load errors (e.g. expected 404s/500s or net errors from fetch/XHR in tests).
    // Only suppress when argsCount is 0, since browser engine network errors have 0 arguments.
    if (
      type === 'error' &&
      argsCount === 0 &&
      (trimmed.startsWith('Failed to load resource:') ||
        trimmed.startsWith('HTTP "Response has status') ||
        trimmed.startsWith('HTTP load failed with status') ||
        trimmed.includes('net::ERR_'))
    ) {
      return false
    }

    // All explicit user output (console.log, console.warn, console.error, console.info, etc.) is shown by default
    return true
  }

  protected async handleConsoleMessage(message: ConsoleMessage): Promise<void> {
    const type = message.type()
    if (type === 'clear' || type === 'time' || type === 'endGroup') {
      // intentionally ignored, they are not useful for debugging
      return
    }
    const text = message.text()
    const args = message.args()
    if (!this.canShow(text, type, args.length)) return

    let file = 'unknown'
    if (typeof message.location === 'function') {
      file = message.location().url || 'unknown'
    }

    if (file.startsWith('http://localhost') || file.startsWith('http://127.0.0.1')) {
      try {
        const urlObj = new URL(file)
        if (urlObj.pathname.startsWith('/@fs/')) {
          file = urlObj.pathname.replace('/@fs', '')
        }
        // we don't strip anything else because mocking API calls often results in localhost URLs that
        // are useful to identify the source of the log
      } catch {
        // ignore errors parsing URLs
      }
    }

    if (!args.length) {
      await this.emitter.emit('browser:log', { file, type, messages: [text] })
      return
    }

    try {
      const processedArgs = await this.processArguments(args)
      await this.emitter.emit('browser:log', { file, type, messages: processedArgs })
    } catch {
      // If args processing fails, emit text-only log
      await this.emitter.emit('browser:log', { file, type, messages: [text] })
    }
  }

  protected async handlePageError(error: Error): Promise<void> {
    if (this.silent) return
    await this.emitter.emit('browser:log', { file: 'unknown', type: 'error', messages: [error] })
  }

  protected async processArguments(args: JSHandle[]): Promise<any[]> {
    return Promise.all(args.map((arg) => this.processArgument(arg)))
  }

  protected async processArgument(arg: JSHandle): Promise<any> {
    try {
      const result = await arg.evaluate((n: any) => {
        // eslint-disable-next-line no-restricted-globals
        if (n instanceof Element) {
          return { __lupa_type: 'element', value: n.outerHTML }
        }
        // eslint-disable-next-line no-restricted-globals
        if (n instanceof Node) {
          return { __lupa_type: 'node', value: n.nodeName }
        }
        if (n instanceof Error) {
          return { __lupa_type: 'error', name: n.name, message: n.message, stack: n.stack }
        }
        return { __lupa_type: 'json', value: n }
      })

      if (result && typeof result === 'object' && '__lupa_type' in result) {
        if (result.__lupa_type === 'error') {
          const err = new Error(result.message)
          if (result.name) err.name = result.name
          err.stack = result.stack
          return err
        }
        return result.value
      }

      return result
    } catch {
      return arg.toString()
    }
  }
}
