import util from 'node:util'
import logUpdate from 'log-update'
import { BaseReporter } from './base.js'
import type {
  RunnerEvents,
  TestEndNode,
  RunnerStartNode,
  WithCorrelation,
  FileEndNode,
  FileStartNode,
} from '../types.js'
import { colors, icons } from '../runner/helpers.js'

const PROGRESS_BLOCKS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']
const PROGRESS_WIDTH = 30

function createProgressBlocks(value: number, total: number): string {
  if (value >= total) {
    return PROGRESS_BLOCKS[8].repeat(PROGRESS_WIDTH)
  }

  const count = total === 0 ? 0 : (PROGRESS_WIDTH * value) / total
  const floored = Math.floor(count)
  const partialBlock = PROGRESS_BLOCKS[Math.floor((count - floored) * (PROGRESS_BLOCKS.length - 1))]
  return `${PROGRESS_BLOCKS[8].repeat(floored)}${partialBlock}${' '.repeat(Math.max(0, PROGRESS_WIDTH - floored - 1))}`
}

interface FileTestStats {
  passed: number
  failed: number
  skipped: number
}

interface BrowserProgressState {
  passedTests: number
  failedTests: number
  skippedTests: number
  executedFiles: Set<string>
  startedFiles: Set<string>
  fileStats: Map<string, FileTestStats>
}

export class ProgressReporter extends BaseReporter {
  #totalFiles = 0
  #lastRenderTime = 0
  #browserStates = new Map<string, BrowserProgressState>()
  #logs: { file: string; type: string; messages: any[] }[] = []

  #getBrowserName(browserId?: string): string {
    if (!browserId) return 'chromium'
    const runner = this.getRunnerOrThrow()
    const chunk = runner.poolManager.getChunk(browserId)
    if (chunk) {
      return chunk.browserName
    }
    for (const name of ['chromium', 'firefox', 'webkit']) {
      if (browserId.startsWith(name)) {
        return name
      }
    }
    return browserId
  }

  #getOrCreateBrowserState(browserName: string): BrowserProgressState {
    let state = this.#browserStates.get(browserName)
    if (!state) {
      state = {
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        executedFiles: new Set<string>(),
        startedFiles: new Set<string>(),
        fileStats: new Map<string, FileTestStats>(),
      }
      this.#browserStates.set(browserName, state)
    }
    return state
  }

  protected override onTestEnd(payload: WithCorrelation<TestEndNode>): void {
    const browserName = this.#getBrowserName(payload.browserId)
    const state = this.#getOrCreateBrowserState(browserName)
    const file = payload.file || (payload.meta as any)?.fileName

    let fStat: FileTestStats | undefined
    if (file) {
      fStat = state.fileStats.get(file)
      if (!fStat) {
        fStat = { passed: 0, failed: 0, skipped: 0 }
        state.fileStats.set(file, fStat)
      }
    }

    if (payload.isSkipped || payload.isTodo) {
      state.skippedTests++
      if (fStat) fStat.skipped++
    } else if (payload.hasError) {
      state.failedTests++
      if (fStat) fStat.failed++
    } else {
      state.passedTests++
      if (fStat) fStat.passed++
    }

    this.render()
  }

  protected override start(node: RunnerStartNode): void {
    this.#totalFiles = node.estimatedTotalFiles
    this.#logs = []
    this.#lastRenderTime = Date.now()

    const isFocusedMode = !!this.config?.filters?.files?.length && this.config.filters.files.length === 1
    const isWatchMode = !!this.config?.watch

    // Reset browser states completely if not in watch mode or if switching focus mode
    if (!isWatchMode || isFocusedMode) {
      this.#browserStates.clear()
    }

    const browserNames = this.getRunnerOrThrow().poolManager.browserNames
    for (const browserName of browserNames) {
      if (!this.#browserStates.has(browserName)) {
        this.#getOrCreateBrowserState(browserName)
      }
    }

    this.render()
  }

  protected override onFileStart(node: WithCorrelation<FileStartNode>): void {
    const browserName = this.#getBrowserName(node.browserId)
    const state = this.#getOrCreateBrowserState(browserName)

    if (node.file && state.fileStats.has(node.file)) {
      const prev = state.fileStats.get(node.file)
      if (prev) {
        state.passedTests = Math.max(0, state.passedTests - prev.passed)
        state.failedTests = Math.max(0, state.failedTests - prev.failed)
        state.skippedTests = Math.max(0, state.skippedTests - prev.skipped)
      }
      state.executedFiles.delete(node.file)
      state.fileStats.delete(node.file)
    }

    state.startedFiles.add(node.file)
    this.render()
  }

  protected override onFileEnd(node: WithCorrelation<FileEndNode>): void {
    const browserName = this.#getBrowserName(node.browserId)
    const state = this.#getOrCreateBrowserState(browserName)
    state.executedFiles.add(node.file)
    state.startedFiles.add(node.file)
    this.render()
  }

  protected override onImportError(payload: RunnerEvents['runner:import_error']): void {
    const browserName = this.#getBrowserName(payload.browserId)
    const state = this.#getOrCreateBrowserState(browserName)
    state.executedFiles.add(payload.file)
    state.startedFiles.add(payload.file)
    state.failedTests++
    this.#logs.push({
      file: payload.file,
      type: 'error',
      messages: ['%c✖ Import Error: %s', 'color: #D32F2F; font-weight: bold', payload.file, payload.error],
    })
    this.render()
  }

  protected override onBrowserLog(payload: RunnerEvents['browser:log']): void {
    this.#logs.push(payload)
    this.render()
  }

  protected override async end(): Promise<void> {
    logUpdate.clear()

    // We flush all buffered logs just in case some came very late
    this.#printLogs()

    console.log('')

    const summary = this.getRunnerOrThrow().getSummary()

    if (this.config?.watch) {
      // In focus mode, no summary aggregates, but we print the final progress bar
      this.#print(this.#getProgressBar(), true)
      logUpdate.done()

      if (summary.hasError) {
        console.log('')
        await this.printImportErrors(summary)
        await this.printErrors(summary)
      }
    } else {
      // Regular end, print progress bar permanently, then summary
      this.#print(this.#getProgressBar(), true)
      logUpdate.done()

      console.log('')
      if (summary.hasError) {
        console.log(`Finished running tests in ${Math.round(summary.duration / 1000)}s with failures.`)
      } else {
        console.log(`Finished running tests in ${Math.round(summary.duration / 1000)}s, all tests passed! 🎉`)
      }

      await this.printSummary(summary)
    }
  }

  #printLogs(): void {
    if (this.#logs.length === 0) return

    const groupedByFile = new Map<string, RunnerEvents['browser:log'][]>()
    for (const log of this.#logs) {
      const file = log.file || 'unknown'
      let logsForFile = groupedByFile.get(file)
      if (!logsForFile) {
        logsForFile = []
        groupedByFile.set(file, logsForFile)
      }
      logsForFile.push(log)
    }

    for (const [file, fileLogs] of groupedByFile.entries()) {
      console.log('')
      console.log(`${colors.cyan(file)}:`)

      for (const log of fileLogs) {
        const isError = log.type === 'error'
        const prefix = isError ? `${icons.cross} Browser error:` : `${icons.browserLog} Browser logs:`
        const prefixColored = log.type === 'error' ? colors.red(prefix) : colors.yellow(prefix)
        console.log(` ${prefixColored}`)

        const formatted = util.formatWithOptions({ colors: true }, ...log.messages)
        formatted.split('\n').forEach((line) => {
          console.log(`      ${line}`)
        })
        // This line is consumed by logUpdate and will be cleared on the next render
        console.log('')
      }
    }

    this.#logs = []
  }

  #getSingleBrowserProgressBar(browserName: string, state: BrowserProgressState, maxBrowserNameLength: number): string {
    const completedFiles = state.executedFiles.size
    const startedFiles = Math.max(completedFiles, state.startedFiles.size)
    const totalExpected = Math.max(startedFiles, this.#totalFiles)

    const completedBlocks = createProgressBlocks(completedFiles, totalExpected)
    const startedBlocks = createProgressBlocks(startedFiles, totalExpected)

    let completedWidth = 0
    while (completedWidth < PROGRESS_WIDTH && completedBlocks[completedWidth] !== ' ') {
      completedWidth++
    }

    let startedWidth = 0
    while (startedWidth < PROGRESS_WIDTH && startedBlocks[startedWidth] !== ' ') {
      startedWidth++
    }

    const completedPart = completedWidth > 0 ? colors.white(completedBlocks.slice(0, completedWidth)) : ''
    const startedPart =
      startedWidth > completedWidth ? colors.gray(startedBlocks.slice(completedWidth, startedWidth)) : ''
    const emptyPart = ' '.repeat(PROGRESS_WIDTH - startedWidth)

    const bar = `|${completedPart}${startedPart}${emptyPart}|`

    const prefix = `${browserName}:`.padEnd(maxBrowserNameLength + 2)
    const message: string[] = [prefix + bar, `${completedFiles}/${totalExpected}`, 'test files |']

    if (state.passedTests > 0) {
      message.push(colors.green(`${state.passedTests} passed,`))
    } else {
      message.push(`${state.passedTests} passed,`)
    }

    if (state.failedTests > 0) {
      message.push(colors.red(`${state.failedTests} failed,`))
    } else {
      message.push(`${state.failedTests} failed,`)
    }

    if (state.skippedTests > 0) {
      message.push(colors.yellow(`${state.skippedTests} skipped`))
    } else {
      message.push(`${state.skippedTests} skipped`)
    }

    return message.join(' ')
  }

  #getProgressBar(): string {
    const browserNames = Array.from(this.#browserStates.keys())
    const maxBrowserNameLength = Math.max(...browserNames.map((name) => name.length), 0)

    return browserNames
      .map((name) => {
        const state = this.#browserStates.get(name)
        if (!state) return ''
        return this.#getSingleBrowserProgressBar(name, state, maxBrowserNameLength)
      })
      .filter(Boolean)
      .join('\n')
  }

  protected render(): void {
    if (this.#logs.length > 0) {
      logUpdate.clear()
    }
    this.#printLogs()
    this.#print(this.#getProgressBar())
  }

  #print(value: string, ignoreTimer = false): void {
    if (!process.stdout.isTTY) {
      const now = Date.now()
      if (now - this.#lastRenderTime > 2000 || ignoreTimer) {
        console.log(value)
        this.#lastRenderTime = now
      }
    } else {
      logUpdate(value)
    }
  }
}
