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
   * When not set, all messages are suppressed, only errors are reported.
   */
  verbose = false

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
   */
  constructor(page: Page, verbose = false, emitter: Emitter<RunnerEvents>, configPath?: string) {
    this.page = page
    this.verbose = verbose
    this.emitter = emitter
    this.configPath = configPath

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

  protected canShow(message: string, _type: string): boolean {
    // We do not want that. There are plenty of situations where tests intentionally
    // cause errors (like network errors) and printing them by default is confusing.
    // if (type === 'error') {
    //   return true
    // }
    if (!this.verbose) {
      return false
    }

    const trimmed = message.trim()
    const startsWithAnyPrefix = this.ignorePrefix.some((prefix) => trimmed.startsWith(prefix))
    return !startsWithAnyPrefix
  }

  protected async handleConsoleMessage(message: ConsoleMessage): Promise<void> {
    const type = message.type()
    if (type === 'clear' || type === 'time' || type === 'endGroup') {
      // intentionally ignored, they are not useful for debugging
      return
    }
    const text = message.text()
    if (!this.canShow(text, type)) return

    const args = message.args()

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
