import util from 'node:util'
import logUpdate from 'log-update'
import { BaseReporter } from './base.js'
import type { RunnerEvents, TestEndNode, RunnerStartNode, WithCorrelation, FileEndNode } from '../types.js'
import { colors, icons } from '../runner/helpers.js'

const PROGRESS_BLOCKS = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']
const PROGRESS_WIDTH = 30

function createProgressBlocks(value: number, total: number) {
  if (value >= total) {
    return PROGRESS_BLOCKS[8].repeat(PROGRESS_WIDTH)
  }

  const count = total === 0 ? 0 : (PROGRESS_WIDTH * value) / total
  const floored = Math.floor(count)
  const partialBlock = PROGRESS_BLOCKS[Math.floor((count - floored) * (PROGRESS_BLOCKS.length - 1))]
  return `${PROGRESS_BLOCKS[8].repeat(floored)}${partialBlock}${' '.repeat(Math.max(0, PROGRESS_WIDTH - floored - 1))}`
}

export class ProgressReporter extends BaseReporter {
  #totalFiles = 0
  #passedTests = 0
  #failedTests = 0
  #skippedTests = 0
  /**
   * A Set of all files that either were already executed or had an import error.
   * We use this to calculate progress, and also to know which files had logs/errors for grouping them in the output.
   */
  #executedFiles = new Set<string>()
  #lastRenderTime = 0

  #logs: { file: string; type: string; messages: any[] }[] = []

  protected override onTestEnd(payload: WithCorrelation<TestEndNode>) {
    if (payload.isSkipped || payload.isTodo) {
      this.#skippedTests++
    } else if (payload.hasError) {
      this.#failedTests++
    } else {
      this.#passedTests++
    }

    this.render()
  }

  protected override start(node: RunnerStartNode) {
    this.#totalFiles = node.estimatedTotalFiles

    this.#passedTests = 0
    this.#failedTests = 0
    this.#skippedTests = 0
    this.#logs = []
    this.#executedFiles.clear()
    this.#lastRenderTime = Date.now()

    this.render()
  }

  protected onFileEnd(node: WithCorrelation<FileEndNode>): void {
    this.#executedFiles.add(node.file)
    this.render()
  }

  protected override onImportError(payload: RunnerEvents['runner:import_error']) {
    this.#executedFiles.add(payload.file)
    this.#logs.push({
      file: payload.file,
      type: 'error',
      messages: ['%c✖ Import Error: %s', 'color: #D32F2F; font-weight: bold', payload.file, payload.error],
    })
    this.render()
  }

  protected override onBrowserLog(payload: RunnerEvents['browser:log']) {
    this.#logs.push(payload)
    this.render()
  }

  protected override async end() {
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

  #printLogs() {
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
      // console.log('')

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

  #getProgressBar(): string {
    const completedFiles = this.#executedFiles.size
    const totalExpected = Math.max(completedFiles, this.#totalFiles)

    const progressBlocks = createProgressBlocks(completedFiles, totalExpected)
    const finishedBlockCount = totalExpected === 0 ? 0 : Math.floor((PROGRESS_WIDTH * completedFiles) / totalExpected)

    const finishedBlocks = colors.white(progressBlocks.slice(0, finishedBlockCount))
    const scheduledBlocks = colors.gray(progressBlocks.slice(finishedBlockCount))
    const bar = `|${finishedBlocks}${scheduledBlocks}|`

    const message: string[] = [bar, `${completedFiles}/${totalExpected}`, 'test files |']

    if (this.#passedTests > 0) {
      message.push(colors.green(`${this.#passedTests} passed,`))
    } else {
      message.push(`${this.#passedTests} passed,`)
    }

    if (this.#failedTests > 0) {
      message.push(colors.red(`${this.#failedTests} failed,`))
    } else {
      message.push(`${this.#failedTests} failed,`)
    }

    if (this.#skippedTests > 0) {
      message.push(colors.yellow(`${this.#skippedTests} skipped`))
    } else {
      message.push(`${this.#skippedTests} skipped`)
    }

    return message.join(' ')
  }

  protected render() {
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
