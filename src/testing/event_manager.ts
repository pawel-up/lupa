import type { ViteHotContext } from 'vite/types/hot.js'
import type { AssertionError } from 'assertion-error'
import type { Emitter } from './emitter.js'
import type { TestError } from '../types.js'

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
   * Boot the event manager.
   *
   * Forwards all emitter events — both built-in framework events and any custom events
   * emitted by browser-side plugins — to Node via the Vite HMR WebSocket channel.
   * Known events with errors are serialized before sending.
   */
  boot(): void {
    if (!this.#ctx) {
      return
    }

    this.#emitter.onAny(({ name, data }: { name: string; data: any }) => {
      // runner:start and runner:end are lifecycle signals managed by the Node orchestrator
      // via activeNodeRunner.start() / activeNodeRunner.end(). Forwarding them over the
      // WebSocket would cause them to fire twice on the Node emitter.
      if (name === 'runner:start' || name === 'runner:end') return

      if (name === 'suite:end' || name === 'group:end' || name === 'test:end') {
        data = { ...data, errors: this.#serializeErrors(data?.errors) }
      } else if (name === 'uncaught:exception' || name === 'runner:import_error') {
        if (data?.error) {
          data = { ...data, error: this.#serializeError(data.error) }
        }
      }
      this.#passThrough(name, data)
    })
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
    const file = data.file || (data.meta && data.meta.file) || 'unknown'
    this.#ctx.send('lupa:telemetry', { event: name, data: { ...data, browserId: chunkId, file } })
  }
}
