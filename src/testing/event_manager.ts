import type { ViteHotContext } from 'vite/types/hot.js'
import type { AssertionError } from 'assertion-error'
import type { Emitter } from './emitter.js'
import type { GroupEndNode, SuiteEndNode, TestEndNode, UncaughtExceptionNode, TestError } from '../types.js'

interface EndError<P> {
  phase: P
  error: TestError
}

/**
 * The events manager is a pass-through from the Emitter to Vite's HMR context.
 */
export class EventManager {
  /**
   * Vite's hot module replacement context
   */
  #ctx?: ViteHotContext

  /**
   * The events emitter
   */
  #emitter: Emitter

  constructor(emitter: Emitter, ctx?: ViteHotContext) {
    this.#emitter = emitter
    this.#ctx = ctx
  }

  /**
   * Boot the event manager
   */
  boot(): void {
    if (!this.#ctx) {
      return
    }

    this.#emitter.on('suite:start', (data) => this.#passThrough('suite:start', data))
    this.#emitter.on('suite:end', this.#handleSuiteEnd.bind(this))
    this.#emitter.on('group:start', (data) => this.#passThrough('group:start', data))
    this.#emitter.on('group:end', this.#handleGroupEnd.bind(this))
    this.#emitter.on('test:start', (data) => this.#passThrough('test:start', data))
    this.#emitter.on('test:end', this.#handleTestEnd.bind(this))
    this.#emitter.on('uncaught:exception', this.#handleUncaughtException.bind(this))
    this.#emitter.on('runner:pinned_tests', (data) => this.#passThrough('runner:pinned_tests', data))
    this.#emitter.on('runner:list', (data) => this.#passThrough('runner:list', data))
  }

  #serializeError(error: TestError): TestError {
    if (error.name === 'AssertionError') {
      return (error as AssertionError<unknown>).toJSON(true) as unknown as TestError
    } else {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name,
      }
    }
  }

  #serializeErrors<P>(errors: EndError<P>[] | undefined): { phase: P; error: TestError }[] {
    if (!Array.isArray(errors) || !errors.length) {
      return []
    }

    return errors.map(({ phase, error }) => {
      return {
        phase,
        error: this.#serializeError(error),
      }
    })
  }

  #passThrough(name: string, data: any): void {
    if (!this.#ctx || !data) {
      return
    }
    const chunkId = (globalThis as any).__lupa__?.chunkId || 'default'
    this.#ctx.send('lupa:telemetry', { event: name, data: { ...data, browserId: chunkId } })
  }

  #handleSuiteEnd(data: SuiteEndNode): void {
    if (!this.#ctx || !data) {
      return
    }
    data.errors = this.#serializeErrors(data.errors)
    this.#passThrough('suite:end', data)
  }

  #handleGroupEnd(data: GroupEndNode): void {
    if (!this.#ctx || !data) {
      return
    }
    data.errors = this.#serializeErrors(data.errors)
    this.#passThrough('group:end', data)
  }

  #handleTestEnd(data: TestEndNode): void {
    if (!this.#ctx || !data) {
      return
    }
    data.errors = this.#serializeErrors(data.errors)
    this.#passThrough('test:end', data)
  }

  #handleUncaughtException(data: UncaughtExceptionNode): void {
    if (!this.#ctx || !data) {
      return
    }
    data.error = this.#serializeError(data.error)
    this.#passThrough('uncaught:exception', data)
  }
}
