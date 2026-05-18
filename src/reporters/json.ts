import { relative } from 'node:path'
import { serializeError, type ErrorObject } from 'serialize-error'
import { BaseReporter } from './base.js'
import type { TestEndNode, RunnerListNode } from '../types.js'

/**
 * The structured output representing the test suite discovery mode (--list).
 */
export interface JSONReporterListResult {
  /**
   * Indicates whether the test discovery was successfully completed.
   */
  success: boolean
  /**
   * The hierarchical list of suites, groups, and tests available in the project.
   */
  list: RunnerListNode
}

/**
 * The structured output representing the results of a test execution run.
 */
export interface JSONReporterExecutionResult {
  /**
   * Indicates whether all executed tests passed successfully.
   */
  success: boolean
  /**
   * Aggregated test execution metrics.
   */
  summary: {
    /** Total number of tests executed. */
    total: number
    /** Number of passed tests. */
    passed: number
    /** Number of failed tests. */
    failed: number
    /** Number of skipped tests. */
    skipped: number
    /** Total duration of the test run in milliseconds. */
    durationMs: number
  }
  /**
   * Detailed list of encountered failures across all tests.
   */
  failures: {
    /** The relative path to the file where the failure occurred. */
    file: string
    /** The expanded title of the failed test. */
    title: string
    /** The serialized error object describing the failure. */
    error: ErrorObject
  }[]
}

/**
 * Represents the overall output shape for the JSON reporter.
 */
export type JSONReporterResult = JSONReporterListResult | JSONReporterExecutionResult

export class JSONReporter extends BaseReporter {
  #failures: { file: string; title: string; error: ErrorObject }[] = []
  #listPayload?: RunnerListNode

  public isProgrammatic = false
  public result?: JSONReporterResult

  #getRelativeFilename(fileName: string) {
    return relative(process.cwd(), fileName)
  }

  protected onTestEnd(payload: TestEndNode): void {
    if (payload.hasError) {
      const file = this.currentFileName ? this.#getRelativeFilename(this.currentFileName) : 'unknown'
      const errors = payload.errors.map((error) => serializeError(error.error))
      this.#failures.push({
        file,
        title: payload.title.expanded,
        error: errors[0], // Simplified to first error for MCP
      })
    }
  }

  protected onRunnerList(payload: RunnerListNode): void {
    if (!this.#listPayload) {
      this.#listPayload = { suites: [] }
    }
    this.#listPayload.suites.push(...payload.suites)
  }

  protected async end() {
    let result: JSONReporterResult

    if (this.#listPayload) {
      result = {
        success: true,
        list: this.#listPayload,
      }
    } else {
      const summary = this.getRunnerOrThrow().getSummary()
      result = {
        success: !summary.hasError,
        summary: {
          total: summary.aggregates.total,
          passed: summary.aggregates.passed,
          failed: summary.aggregates.failed,
          skipped: summary.aggregates.skipped,
          durationMs: summary.duration,
        },
        failures: this.#failures,
      }
    }

    this.result = result

    if (!this.isProgrammatic) {
      console.log(JSON.stringify(result, null, 2))
    }
  }
}
