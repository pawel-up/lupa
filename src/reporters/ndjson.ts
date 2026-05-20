/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { relative } from 'node:path'
import { serializeError } from 'serialize-error'

import { BaseReporter } from './base.js'
import type { TestEndNode, SuiteEndNode, GroupEndNode, SuiteStartNode, GroupStartNode } from '../types.js'

/**
 * Prints tests progress as JSON. Each event is emitted
 * independently
 */
export class NdJSONReporter extends BaseReporter {
  /**
   * Returns the filename relative from the current working dir
   */
  #getRelativeFilename(fileName: string) {
    return relative(process.cwd(), fileName)
  }

  /**
   * Serialize errors to JSON
   */
  #serializeErrors(errors: TestEndNode['errors'] | GroupEndNode['errors'] | SuiteEndNode['errors']) {
    return errors.map((error) => ({
      phase: error.phase,
      error: serializeError(error.error),
    }))
  }

  protected onTestEnd(payload: TestEndNode): void {
    const fileName = payload.meta?.fileName
    console.log(
      JSON.stringify({
        event: 'test:end',
        filePath: fileName,
        relativePath: fileName ? this.#getRelativeFilename(fileName) : undefined,
        title: payload.title,
        duration: payload.duration,
        failReason: payload.failReason,
        isFailing: payload.isFailing,
        skipReason: payload.skipReason,
        isSkipped: payload.isSkipped,
        isTodo: payload.isTodo,
        isPinned: payload.isPinned,
        retryAttempt: payload.retryAttempt,
        retries: payload.retries,
        errors: this.#serializeErrors(payload.errors),
      })
    )
  }

  protected onGroupStart(payload: GroupStartNode): void {
    console.log(
      JSON.stringify({
        event: 'group:start',
        title: payload.title,
      })
    )
  }

  protected onGroupEnd(payload: GroupEndNode): void {
    console.log(
      JSON.stringify({
        event: 'group:end',
        title: payload.title,
        errors: this.#serializeErrors(payload.errors),
      })
    )
  }

  protected onSuiteStart(payload: SuiteStartNode): void {
    console.log(
      JSON.stringify({
        event: 'suite:start',
        ...payload,
      })
    )
  }

  protected onSuiteEnd(payload: SuiteEndNode): void {
    console.log(
      JSON.stringify({
        event: 'suite:end',
        name: payload.name,
        hasError: payload.hasError,
        errors: this.#serializeErrors(payload.errors),
      })
    )
  }

  protected async end() {
    const summary = this.getRunnerOrThrow().getSummary()
    console.log(
      JSON.stringify({
        aggregates: summary.aggregates,
        duration: summary.duration,
        failedTestsTitles: summary.failedTestsTitles,
        hasError: summary.hasError,
      })
    )
  }
}
