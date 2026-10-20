import { type BrowserType, chromium, firefox, webkit, type Browser } from 'playwright'
import type { Key } from 'node:readline'
import type { ViteDevServer } from 'vite'
import { Emitter } from '../testing/emitter.js'
import type { RunnerEvents } from '../types.js'
import { FilesManager } from './files_manager.js'
import debug from './debug.js'
import { CommandsHandler } from '../commands/rpc_handler.js'
import { colors, matchesPath } from './helpers.js'
import { Runner } from './runner.js'
import type { Orchestrator } from './orchestrator.js'

export class Cli {
  #orchestrator: Orchestrator

  #focusedFile: string | null = null
  #focusedPath: string | null = null
  #originalFilesFilter: string[] | undefined
  #fileEvents = new Map<string, { eventName: string; data: any }[]>()
  #suiteStartEvents = new Map<string, any>()
  #suiteEndEvents = new Map<string, any>()
  #isReplaying = false
  #excludedFilePaths = new Set<string>()

  debugBrowser: Browser | undefined

  constructor(orchestrator: Orchestrator) {
    this.#orchestrator = orchestrator
  }

  setExcludedFilePaths(paths: Set<string>): void {
    this.#excludedFilePaths = paths
  }

  get focusedFile(): string | null {
    return this.#focusedFile
  }

  get focusedPath(): string | null {
    return this.#focusedPath
  }

  get isFocused(): boolean {
    return !!this.#focusedPath
  }

  get originalFilesFilter(): string[] | undefined {
    return this.#originalFilesFilter
  }

  /**
   * Determines whether the focused file is executing in the current cycle.
   * Always returns true when focus mode is inactive.
   */
  isFocusedRunning(activeFilesFilter?: string[]): boolean {
    const focusedPath = this.#focusedPath
    if (!this.isFocused || !focusedPath) return true
    if (!activeFilesFilter || activeFilesFilter.length === 0) return true
    return activeFilesFilter.some((f) => matchesPath(f, focusedPath))
  }

  /**
   * Sets focus to a specific test file path.
   */
  focusOnFile(filePath: string): void {
    this.#focusedPath = filePath
    this.#focusedFile = filePath.split('/').pop() || null
    this.#orchestrator.config.filters.files = [filePath]
  }

  /**
   * Returns buffered events for all executed files.
   */
  getFileEvents(): Map<string, { eventName: string; data: any }[]> {
    return this.#fileEvents
  }

  /**
   * Returns buffered suite:start events.
   */
  getSuiteStartEvents(): Map<string, any> {
    return this.#suiteStartEvents
  }

  /**
   * Returns buffered suite:end events.
   */
  getSuiteEndEvents(): Map<string, any> {
    return this.#suiteEndEvents
  }

  printWaitingMessage(): void {
    if (this.#focusedFile) {
      console.log(
        `\n${colors.cyan(`[Focus Mode: ${this.#focusedFile}]`)} Waiting for file changes... (Press Enter to re-run, Esc or q to exit focus, f to pick another, d to debug)`
      )
    } else {
      console.log(
        `\n${colors.green('[Watch Mode]')} Waiting for file changes... (Press Enter to re-run, q to quit, f to focus)`
      )
    }
  }

  #currentRunningTestFile: string | null = null

  /**
   * Clears the event buffer for files that are about to be re-run
   */
  clearEventBufferFor(filesFilter?: string[]): void {
    if (!filesFilter || filesFilter.length === 0) {
      this.#fileEvents.clear()
      this.#suiteStartEvents.clear()
      this.#suiteEndEvents.clear()
      return
    }

    // Clear only events for files that match the filter
    for (const file of Array.from(this.#fileEvents.keys())) {
      if (filesFilter.some((f) => matchesPath(file, f))) {
        this.#fileEvents.delete(file)
      }
    }
  }

  /**
   * Re-emits cached events for test files that were NOT executed in the current watch cycle
   * so reporters render full suite progress and accurate totals.
   */
  async replayCachedEventsForUnchangedFiles(
    activeNodeEmitter: Emitter<RunnerEvents>,
    activeFilesFilter?: string[]
  ): Promise<void> {
    this.#isReplaying = true
    try {
      for (const suiteStart of this.#suiteStartEvents.values()) {
        await activeNodeEmitter.emit('suite:start', suiteStart)
      }
      for (const [file, events] of this.#fileEvents.entries()) {
        if (activeFilesFilter && activeFilesFilter.some((f) => matchesPath(file, f))) {
          continue
        }
        for (const event of events) {
          await activeNodeEmitter.emit(event.eventName as any, event.data)
        }
      }
    } finally {
      this.#isReplaying = false
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

      if (eventName === 'file:start') {
        this.#currentRunningTestFile = data?.file || null
      } else if (eventName === 'file:end') {
        if (this.#currentRunningTestFile === data?.file) {
          this.#currentRunningTestFile = null
        }
      } else if (eventName === 'runner:end') {
        this.#currentRunningTestFile = null
      }

      // We don't buffer events if we are just replaying
      if (!this.#isReplaying) {
        if (
          [
            'file:start',
            'file:end',
            'group:start',
            'group:end',
            'test:start',
            'test:end',
            'runner:import_error',
            'browser:log',
          ].includes(eventName)
        ) {
          let fileName = data?.file || data?.meta?.file || data?.meta?.fileName || ''
          if (!fileName || fileName === 'unknown') {
            fileName =
              this.#currentRunningTestFile ||
              (this.#orchestrator.config.filters?.files?.length === 1
                ? this.#orchestrator.config.filters.files[0]
                : '') ||
              (this.isFocused ? (this.#focusedPath ?? '') : '') ||
              ''
            if (fileName && data && (!data.file || data.file === 'unknown')) {
              data.file = fileName
            }
          }
          if (fileName) {
            let events = this.#fileEvents.get(fileName)
            if (!events) {
              events = []
              this.#fileEvents.set(fileName, events)
            }
            events.push({ eventName, data })
          }
        } else if (eventName === 'suite:start') {
          const key = `${data?.name}:${data?.browserId}`
          this.#suiteStartEvents.set(key, data)
        } else if (eventName === 'suite:end') {
          const key = `${data?.name}:${data?.browserId}`
          this.#suiteEndEvents.set(key, data)
        }
      }

      // Suppress file:start / file:end for suites marked excludeFromReporting
      if (this.#excludedFilePaths.size > 0 && (eventName === 'file:start' || eventName === 'file:end')) {
        const filePath = data?.file || ''
        if (filePath && this.#excludedFilePaths.has(filePath)) {
          return
        }
      }

      if (this.isFocused) {
        const focusedPath = this.#focusedPath
        const currentFilters = this.#orchestrator.config.filters?.files || []
        const isFocusedRunning = this.isFocusedRunning(currentFilters)

        // If the focused file is NOT running in this execution (background run), suppress from active reporters
        if (!isFocusedRunning) {
          return
        }

        // Clamp estimated total files to 1 for the focused file
        if (eventName === 'runner:start') {
          await filteredEmitter.emit('runner:start', { ...data, estimatedTotalFiles: 1, isFocused: true })
          return
        }

        // Suppress events belonging to other files
        const fileName = data?.file || data?.meta?.file || data?.meta?.fileName || ''
        if (fileName && focusedPath && !matchesPath(fileName, focusedPath)) {
          return
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

    const fileFilters = this.#originalFilesFilter
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

  #onKeypress = async (_str: string | undefined, key: Key): Promise<void> => {
    if (key.ctrl && key.name === 'c') {
      await this.#orchestrator.shutdown(0)
    }

    if (key.name === 'return' || key.name === 'enter') {
      if (this.isFocused && this.#focusedPath) {
        this.#orchestrator.config.filters.files = [this.#focusedPath]
      }
      await this.#orchestrator.executeTests()
    } else if (key.name === 'q') {
      if (this.isFocused) {
        await this.exitFocusMode()
      } else {
        await this.#orchestrator.shutdown(0)
      }
    } else if (key.name === 'escape') {
      if (this.isFocused) {
        await this.exitFocusMode()
      }
    } else if (key.name === 'f') {
      await this.#promptFocusFile()
    } else if (key.name === 'd') {
      await this.handleDebugBrowser()
    }
  }

  /**
   * Exits focus mode and replays all captured test results without re-executing.
   */
  async exitFocusMode(): Promise<void> {
    if (!this.#focusedPath && !this.#focusedFile) return

    this.#focusedFile = null
    this.#focusedPath = null
    this.#orchestrator.config.filters.files = this.#originalFilesFilter
    console.log('\n[Watch Mode] Exited focus mode. Re-rendering previous results...')
    await this.#replayEvents()
  }

  protected async handleDebugBrowser(): Promise<void> {
    if (!this.#focusedPath) {
      console.log('\n[Focus Mode] Select a file to debug')
      await this.#promptFocusFile()
    }

    if (!this.#focusedPath) {
      return
    }

    if (this.debugBrowser) {
      console.log('\nDebug browser is already open.')
      return
    }

    let launchClass: BrowserType = chromium
    if (this.#orchestrator.defaultBrowserType === 'firefox') launchClass = firefox
    if (this.#orchestrator.defaultBrowserType === 'webkit') launchClass = webkit

    await this.openDebugBrowser(launchClass)
  }

  protected async openDebugBrowser(launchClass: BrowserType): Promise<void> {
    console.log(`\nOpening debug browser for ${this.#focusedFile}...`)

    const launchOptions: any = { headless: false }
    if (launchClass === chromium) {
      launchOptions.devtools = true
    } else if (launchClass === firefox) {
      launchOptions.firefoxUserPrefs = {
        'privacy.bounceTrackingProtection.enable': false,
        'privacy.bounceTrackingProtection.mode': 0,
      }
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

    const focusedPath = this.#focusedPath
    const browserName = this.#orchestrator.defaultBrowserType
    const chunkId = focusedPath
      ? (this.#orchestrator.poolManager?.getChunkIdForFile(browserName, focusedPath) ?? `${browserName}-0`)
      : `${browserName}-0`
    url.searchParams.append('chunkId', chunkId)
    url.searchParams.append('debug', '1')
    if (focusedPath) {
      url.searchParams.append('file', focusedPath)
    }

    await debugPage.goto(url.toString())
  }

  #pendingWatchFile: string | null = null
  #isExecutingWatch = false

  async start(): Promise<void> {
    // Keep a reference to the original configured files filters
    this.#orchestrator.config.filters = this.#orchestrator.config.filters || {}
    this.#originalFilesFilter = this.#orchestrator.config.filters.files

    this.#orchestrator.vite?.watcher.on('change', (file) => {
      this.#pendingWatchFile = file
      this.#triggerWatchRun()
    })

    if (!process.stdout.isTTY) return

    const readline = await import('node:readline')
    readline.emitKeypressEvents(process.stdin)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }

    process.stdin.on('keypress', this.#onKeypress)
  }

  async #triggerWatchRun(): Promise<void> {
    if (this.#orchestrator.isRunning || this.#isExecutingWatch) {
      return
    }
    const file = this.#pendingWatchFile
    if (!file) return
    this.#pendingWatchFile = null
    this.#isExecutingWatch = true

    try {
      const isTestFile = file.includes('.spec.') || file.includes('.test.')
      let targetFiles: string[] = []

      if (isTestFile) {
        targetFiles = [file]
      } else {
        const affected = await this.#getAffectedTestFiles(file)
        targetFiles = affected
      }

      if (targetFiles.length === 0) {
        debug('Ignoring change in %s as no test files depend on it', file)
        return
      }

      if (this.isFocused) {
        const focusedPath = this.#focusedPath as string
        const isFocusedAffected = targetFiles.some(
          (f) => f === focusedPath || f.endsWith(focusedPath) || focusedPath.endsWith(f)
        )

        if (isFocusedAffected) {
          targetFiles = [
            focusedPath,
            ...targetFiles.filter((f) => f !== focusedPath && !f.endsWith(focusedPath) && !focusedPath.endsWith(f)),
          ]
          debug('[Focus Mode] Focused file %s affected. Prioritizing at head of execution queue.', focusedPath)
        } else {
          debug('[Focus Mode] Unfocused file %s changed. Executing in background to update cache and errors.', file)
        }

        this.#orchestrator.config.filters.files = targetFiles
        await this.#orchestrator.executeTests()
        this.#orchestrator.config.filters.files = [focusedPath]
      } else {
        console.log(`\n[Watch Mode] File changed. Found ${targetFiles.length} affected test file(s). Re-running...`)
        this.#orchestrator.config.filters.files = targetFiles
        await this.#orchestrator.executeTests()
        this.#orchestrator.config.filters.files = this.#originalFilesFilter
      }
    } finally {
      this.#isExecutingWatch = false
      if (this.#pendingWatchFile) {
        await this.#triggerWatchRun()
      }
    }
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
      this.focusOnFile(selected.pathname)
      console.log(`\nAuto-focusing on: ${this.#focusedFile}`)
      await this.#orchestrator.executeTests()
      return
    }

    const failedFiles = new Set<string>()
    for (const events of this.#fileEvents.values()) {
      for (const event of events) {
        if (event.eventName === 'test:end' && event.data?.hasError) {
          const fileName = event.data?.file || event.data?.meta?.file || event.data?.meta?.fileName
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
    this.focusOnFile(selected.pathname)
    console.log(`\nFocusing on: ${this.#focusedFile}`)
    await this.#orchestrator.executeTests()
  }

  async #replayEvents(): Promise<void> {
    this.#isReplaying = true
    console.clear()

    const replayEmitter = new Emitter<RunnerEvents>()
    const poolManager = this.#orchestrator.poolManager
    if (!poolManager) {
      throw new Error('Cannot replay events: Orchestrator is not booted.')
    }
    const replayRunner = new Runner(replayEmitter, this.#orchestrator.config, poolManager)

    // Wire reporters directly
    for (const reporter of this.#orchestrator.reporters || []) {
      replayRunner.registerReporter(reporter)
    }

    const totalFiles = poolManager.getFilesCount(true) || this.#fileEvents.size
    await replayRunner.start()
    await replayEmitter.emit('runner:start', {
      estimatedTotalFiles: totalFiles,
      isReplay: true,
      isFocused: false,
    } as any)

    for (const suiteStart of this.#suiteStartEvents.values()) {
      await replayEmitter.emit('suite:start', suiteStart)
    }

    for (const events of this.#fileEvents.values()) {
      for (const event of events) {
        await replayEmitter.emit(event.eventName as any, event.data)
      }
    }

    for (const suiteEnd of this.#suiteEndEvents.values()) {
      await replayEmitter.emit('suite:end', suiteEnd)
    }

    await replayRunner.end()

    this.#isReplaying = false
    this.printWaitingMessage()
  }
}
