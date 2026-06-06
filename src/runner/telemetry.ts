import type { ViteDevServer } from 'vite'
import type { RunnerEvents } from '../types.js'
import type { Orchestrator } from './orchestrator.js'
import { transformBrowserStack } from './stack_transformer.js'

export type TelemetryPayload = {
  [K in keyof RunnerEvents]: { event: K; data: RunnerEvents[K] }
}[keyof RunnerEvents]

// Helper to reconstruct Error objects with source-mapped stacks
const deserializeError = async (errPayload: any, cwd: string, vite?: ViteDevServer) => {
  if (!errPayload || typeof errPayload !== 'object' || !errPayload.message || errPayload instanceof Error) {
    return errPayload
  }

  const cleanViteStr = (str: string) => {
    if (typeof str !== 'string') return str
    return str
      .replace(/https?:\/\/[^/]+\/@fs\//g, '/')
      .replace(/https?:\/\/[^/]+\//g, '/')
      .replace(/\?import(?::undefined:undefined)?/g, '')
  }

  const err = new Error(cleanViteStr(errPayload.message))
  Object.assign(err, errPayload)
  err.name = errPayload.name || 'Error'
  err.message = cleanViteStr(err.message)

  if (errPayload.stack && vite) {
    err.stack = await transformBrowserStack(vite, cwd, errPayload.stack)
    err.stack = cleanViteStr(err.stack)
    // Rewrite the redundant import error stack frame to omit the duplicate message
    // and inject dummy line:col to prevent Japa printing ":undefined:undefined"
    err.stack = err.stack
      .replace(/at TypeError: Failed to fetch dynamically imported module: \/ \(([^)]+)\)/g, 'at ($1:1:1)')
      .replace(/\(fstests\//g, '(tests/')
  } else {
    err.stack = cleanViteStr(errPayload.stack)
  }
  return err
}

/**
 * A class that specializes in receiving from the browser telemetry events
 * and forwarding them to the telemetry service.
 */
export class Telemetry {
  #orchestrator: Orchestrator
  #cwd: string
  #telemetryQueue: Promise<void> = Promise.resolve()

  constructor(orchestrator: Orchestrator) {
    this.#orchestrator = orchestrator
    this.#cwd = orchestrator.config.cwd || process.cwd()
    this.handleLupaTelemetryEvent = this.handleLupaTelemetryEvent.bind(this)
  }

  /**
   * Processes the telemetry event sent from the browser's WSS connection.
   * It prepares the data for the telemetry service by deserializing errors
   * and cleaning the stack traces. It then re-emits the event through the
   * orchestrator's telemetry service.
   *
   * This method must be called for every telemetry event sent from the browser.
   *
   * @param event The telemetry event to process
   */
  public async handleLupaTelemetryEvent(event: TelemetryPayload): Promise<void> {
    this.#telemetryQueue = this.#telemetryQueue.then(() => this.#processTelemetryEvent(event))
  }

  async #processTelemetryEvent({ event, data }: TelemetryPayload): Promise<void> {
    const vite = this.#orchestrator.serverManager?.vite
    try {
      if (event === 'suite:start') {
        if (data?.browserId) {
          this.#orchestrator.browserManager?.markChunkAsStarted(data.browserId)
        }
      }

      if (event === 'group:end' || event === 'suite:end' || event === 'test:end') {
        if (data.errors && data.errors.length) {
          for (const e of data.errors) {
            e.error = await deserializeError(e.error, this.#cwd, vite)
          }
        }
      } else if (event === 'uncaught:exception') {
        if (data && data.error) {
          data.error = await deserializeError(data.error, this.#cwd, vite)
          this.#orchestrator.exceptionsManager.handleBrowserException(data.error as Error, data.type || 'error')
          return
        }
      } else if (event === 'runner:import_error') {
        if (data && data.error) {
          data.error = await deserializeError(data.error, this.#cwd, vite)
        }
      }

      // Emit telemetry event to the orchestrator's active node emitter
      await this.#orchestrator.activeNodeEmitter?.emit(event, data)
    } catch (queueErr) {
      console.error('Lupa Telemetry parsing error:', queueErr)
    }
  }

  /**
   * Resolves when all queued telemetry events have been processed.
   * Must be awaited before ending the runner to ensure no events are lost.
   */
  drainTelemetry(): Promise<void> {
    return this.#telemetryQueue
  }
}
