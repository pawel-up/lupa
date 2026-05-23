import { type BrowserType, chromium, firefox, webkit, type Browser } from 'playwright'
import type { Key } from 'node:readline'
import type { ViteDevServer } from 'vite'
import { Emitter } from '../testing/emitter.js'
import type { RunnerEvents } from '../types.js'
import { FilesManager } from './files_manager.js'
import debug from './debug.js'
import { CommandsHandler } from '../commands/rpc_handler.js'
import { colors } from './helpers.js'
import { Runner } from './runner.js'
import type { Orchestrator } from './orchestrator.js'

export class Cli {
  #orchestrator: Orchestrator

  #focusedFile: string | null = null
  #originalFilesFilter: string[] | undefined
  #fileEvents = new Map<string, { eventName: string; data: any }[]>()
  #isReplaying = false

  debugBrowser: Browser | undefined

  constructor(orchestrator: Orchestrator) {
    this.#orchestrator = orchestrator
  }

  get focusedFile() {
    return this.#focusedFile
  }

  printWaitingMessage() {
    if (this.#focusedFile) {
      console.log(
        `\n${colors.cyan(`[Focus Mode: ${this.#focusedFile}]`)} Waiting for file changes... (Press Enter to re-run, q to quit, f to pick another, Esc to clear focus, d to debug)`
      )
    } else {
      console.log(
        `\n${colors.green('[Watch Mode]')} Waiting for file changes... (Press Enter to re-run, q to quit, f to focus)`
      )
    }
  }

  /**
   * Clears the event buffer for files that are about to be re-run
   */
  clearEventBufferFor(filesFilter?: string[]) {
    if (!filesFilter) {
      this.#fileEvents.clear()
      return
    }

    // Clear only events for files that match the filter
    for (const file of this.#fileEvents.keys()) {
      if (filesFilter.some((f) => file.includes(f) || f.includes(file))) {
        this.#fileEvents.set(file, [])
      }
    }
  }

  /**
   * Creates an interceptor emitter that buffers events and filters
   * them based on the current focused file before reaching reporters.
   */
  createFilteredEmitter(activeNodeEmitter: Emitter<RunnerEvents>): Emitter<RunnerEvents> {
    const filteredEmitter = new Emitter<RunnerEvents>()

    activeNodeEmitter.onAny(async (eventObj: any) => {
      const eventName = eventObj.name || eventObj.eventName
      const data = eventObj.data || eventObj.eventData

      // We don't buffer events if we are just replaying
      if (!this.#isReplaying) {
        if (['suite:start', 'group:start', 'test:start', 'test:end', 'group:end', 'suite:end'].includes(eventName)) {
          const fileName = data?.file || data?.meta?.fileName || ''
          if (fileName) {
            let events = this.#fileEvents.get(fileName)
            if (!events) {
              events = []
              this.#fileEvents.set(fileName, events)
            }
            events.push({ eventName, data })
          }
        }
      }

      // Filter if a focused file is active
      if (this.#focusedFile) {
        if (['suite:start', 'group:start', 'test:start', 'test:end', 'group:end', 'suite:end'].includes(eventName)) {
          const fileName = data?.file || data?.meta?.fileName || ''
          // If the event doesn't belong to the focused file, suppress it
          if (fileName && !fileName.includes(this.#focusedFile)) {
            return
          }
        }
      }

      // Emit to reporters
      await filteredEmitter.emit(eventName, data)
    })

    return filteredEmitter
  }

  async #getAllTestFiles(): Promise<URL[]> {
    const fileManager = new FilesManager()
    const cwd = this.#orchestrator.config.cwd
    const exclude = this.#orchestrator.config.exclude || []

    let urls: URL[] = []
    if ('files' in this.#orchestrator.config) {
      urls = await fileManager.getFiles(cwd, this.#orchestrator.config.files, exclude)
    } else if ('suites' in this.#orchestrator.config) {
      for (const suite of this.#orchestrator.config.suites) {
        urls.push(...(await fileManager.getFiles(cwd, suite.files, exclude)))
      }
    }

    const fileFilters = this.#orchestrator.config.filters?.files
    if (fileFilters && fileFilters.length > 0) {
      return urls.filter((u) => fileFilters.some((allowed) => u.pathname.endsWith(allowed)))
    }
    return urls
  }

  /**
   * Traverse Vite's module graph to find all test files that import the changed file.
   */
  async #getAffectedTestFiles(changedFile: string): Promise<string[]> {
    const allTestFiles = await this.#getAllTestFiles()

    // Create a map of absolute paths to our known test files for fast lookup
    const testFilePaths = new Set(allTestFiles.map((f) => f.pathname))
    const affected = new Set<string>()

    const mods = this.#orchestrator.vite?.moduleGraph.getModulesByFile(changedFile)
    if (!mods || mods.size === 0) {
      return [] // No modules depend on this yet
    }

    // BFS traversal up the importers tree
    const visited = new Set<string>()
    const queue = Array.from(mods)

    while (queue.length > 0) {
      const mod = queue.shift()
      if (!mod || !mod.file || visited.has(mod.file)) continue

      visited.add(mod.file)

      // Is this module itself a test file?
      if (testFilePaths.has(mod.file)) {
        affected.add(mod.file)
      }

      // Add all its importers to the queue
      if (mod.importers) {
        for (const importer of mod.importers) {
          queue.push(importer)
        }
      }
    }

    return Array.from(affected)
  }

  #onKeypress = async (_str: string | undefined, key: Key) => {
    if (key.ctrl && key.name === 'c') {
      await this.#orchestrator.shutdown(0)
    }

    if (key.name === 'return' || key.name === 'enter') {
      this.#orchestrator.executeTests()
    } else if (key.name === 'q') {
      await this.#orchestrator.shutdown(0)
    } else if (key.name === 'f') {
      // Toggle focus mode
      if (this.#focusedFile) {
        // If already in focus mode, pressing f again lets them pick a new file
        await this.#promptFocusFile()
      } else {
        // Enter focus mode
        await this.#promptFocusFile()
      }
    } else if (key.name === 'escape') {
      if (this.#focusedFile) {
        this.#focusedFile = null
        this.#orchestrator.config.filters.files = this.#originalFilesFilter
        console.log('\n[Watch Mode] Exited focus mode. Re-rendering previous results...')
        await this.#replayEvents()
      }
    } else if (key.name === 'd') {
      this.handleDebugBrowser()
    }
  }

  protected async handleDebugBrowser() {
    if (!this.#focusedFile) {
      console.log('\n[Focus Mode] Select a file to debug')
      await this.#promptFocusFile()
    }

    if (!this.#focusedFile) {
      return
    }

    if (this.debugBrowser) {
      console.log('\nDebug browser is already open.')
      return
    }

    let launchClass = chromium
    if (this.#orchestrator.defaultBrowserType === 'firefox') launchClass = firefox
    if (this.#orchestrator.defaultBrowserType === 'webkit') launchClass = webkit

    await this.openDebugBrowser(launchClass)
  }

  protected async openDebugBrowser(launchClass: BrowserType): Promise<void> {
    console.log('\nOpening debug browser...')

    const launchOptions: any = { headless: false }
    if (launchClass === chromium) {
      launchOptions.devtools = true
    }

    this.debugBrowser = await launchClass.launch(launchOptions)
    const debugPage = await this.debugBrowser.newPage()

    const commandsHandler = new CommandsHandler(debugPage)
    await commandsHandler.boot()

    const browser = this.debugBrowser
    debugPage.on('close', async () => {
      debug('closing debug browser')
      await commandsHandler.teardown()
      await browser.close().catch(() => {
        debug('browser already closed')
      })
      if (this.debugBrowser === browser) {
        this.debugBrowser = undefined
      }
    })

    const vite = this.#orchestrator.vite as ViteDevServer
    const url = new URL(
      '/__lupa__/runner.html',
      vite.resolvedUrls?.local[0] || `http://localhost:${vite.config.server.port}`
    )

    const focusedPath = this.#orchestrator.config.filters?.files?.[0]
    const browserName = this.#orchestrator.defaultBrowserType
    // we need to find the chunk that corresponds to the focused file to pass it to the debug page,
    // so it can load the correct test files and config
    const chunkId = focusedPath
      ? (this.#orchestrator.testPoolManager?.getChunkIdForFile(browserName, focusedPath) ?? `${browserName}-0`)
      : `${browserName}-0`
    url.searchParams.append('chunkId', chunkId)
    url.searchParams.append('debug', '1')

    await debugPage.goto(url.toString())
  }

  async start() {
    // Keep a reference to the original configured files filters
    this.#orchestrator.config.filters = this.#orchestrator.config.filters || {}
    this.#originalFilesFilter = this.#orchestrator.config.filters.files

    this.#orchestrator.vite?.watcher.on('change', async (file) => {
      // ... existing watcher logic ...
      if (this.#focusedFile) {
        this.#orchestrator.executeTests()
        return
      }
      const affected = await this.#getAffectedTestFiles(file)
      if (affected.length > 0) {
        console.log(`\n[Watch Mode] File changed. Found ${affected.length} affected test file(s). Re-running...`)
        this.#orchestrator.config.filters.files = affected
        await this.#orchestrator.executeTests()
      } else {
        if (file.includes('.spec.') || file.includes('.test.')) {
          console.log(`\n[Watch Mode] Test file changed: ${file.split('/').pop()}. Re-running...`)
          this.#orchestrator.config.filters.files = [file]
          await this.#orchestrator.executeTests()
        } else {
          debug('Ignoring change in %s as no test files depend on it', file)
        }
      }
      this.#orchestrator.config.filters.files = this.#originalFilesFilter
    })

    if (!process.stdout.isTTY) return

    const readline = await import('node:readline')
    readline.emitKeypressEvents(process.stdin)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }

    process.stdin.on('keypress', this.#onKeypress)
  }

  async #promptFocusFile(): Promise<void> {
    process.stdin.off('keypress', this.#onKeypress)

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false)
    }

    console.log('\nDiscovering test files...')
    const allFiles = await this.#getAllTestFiles()

    if (allFiles.length === 0) {
      console.log('No test files found.')
      if (process.stdin.isTTY) process.stdin.setRawMode(true)
      process.stdin.on('keypress', this.#onKeypress)
      return
    }

    if (allFiles.length === 1) {
      if (process.stdin.isTTY) process.stdin.setRawMode(true)
      process.stdin.on('keypress', this.#onKeypress)
      const selected = allFiles[0]
      this.#focusedFile = selected.pathname.split('/').pop() || null
      this.#orchestrator.config.filters.files = [selected.pathname]
      console.log(`\nAuto-focusing on: ${this.#focusedFile}`)
      this.#orchestrator.executeTests()
      return
    }

    const failedFiles = new Set<string>()
    for (const events of this.#fileEvents.values()) {
      for (const event of events) {
        if (event.eventName === 'test:end' && event.data?.hasError) {
          const fileName = event.data?.file || event.data?.meta?.fileName
          if (fileName) failedFiles.add(fileName)
        }
      }
    }

    const failed = allFiles.filter((f) => failedFiles.has(f.pathname))
    const passed = allFiles.filter((f) => !failedFiles.has(f.pathname))
    const displayList: URL[] = []

    if (passed.length > 0) {
      console.log(failed.length > 0 ? '\nPassing tests:' : '\nAll tests:')
      passed.forEach((file) => {
        const cwd = this.#orchestrator.config.cwd || process.cwd()
        const relPath = file.pathname.replace(cwd + '/', '')
        displayList.push(file)
        console.log(`${displayList.length}) ${relPath}`)
      })
    }

    if (failed.length > 0) {
      console.log(`\n${colors.bold(colors.red('Failing tests:'))}`)
      failed.forEach((file) => {
        const cwd = this.#orchestrator.config.cwd || process.cwd()
        const relPath = file.pathname.replace(cwd + '/', '')
        displayList.push(file)
        console.log(colors.red(`${displayList.length}) ${relPath}`))
      })
    }

    const { number } = await import('@inquirer/prompts')
    const num = await number({
      message: 'Enter file number (or press Enter to cancel):',
      min: 1,
      max: displayList.length,
      required: false,
    })

    process.stdin.resume()

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }

    process.stdin.on('keypress', this.#onKeypress)

    if (num === undefined) {
      console.log('\nCancelled focus mode selection.')
      this.printWaitingMessage()
      return
    }

    const selected = displayList[num - 1]
    this.#focusedFile = selected.pathname.split('/').pop() || null
    this.#orchestrator.config.filters.files = [selected.pathname]
    console.log(`\nFocusing on: ${this.#focusedFile}`)
    this.#orchestrator.executeTests()
  }

  async #replayEvents() {
    this.#isReplaying = true
    console.clear()

    const replayEmitter = new Emitter<RunnerEvents>()
    const replayRunner = new Runner(replayEmitter, this.#orchestrator.config)

    // Wire reporters directly
    for (const reporter of this.#orchestrator.reporters || []) {
      replayRunner.registerReporter(reporter)
    }

    await replayRunner.start()
    await replayEmitter.emit('runner:start', { estimatedTotalFiles: 0 })

    for (const events of this.#fileEvents.values()) {
      for (const event of events) {
        await replayEmitter.emit(event.eventName as any, event.data)
      }
    }

    await replayEmitter.emit('runner:end', { hasError: replayRunner.failed })
    await replayRunner.end()

    this.#isReplaying = false
    this.printWaitingMessage()
  }
}
