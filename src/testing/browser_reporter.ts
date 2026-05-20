/* eslint-disable no-console */
import type { Emitter } from './emitter.js'
import type { BrowserTelemetryEvents } from '../types.js'

/**
 * A built-in reporter for the browser environment that visually
 * outputs test results into the browser DevTools console
 * when running tests in debug mode.
 */
export class BrowserReporter {
  boot(emitter: Emitter<BrowserTelemetryEvents>) {
    emitter.on('suite:start', (payload) => {
      console.group(`%cSuite: ${payload.name}`, 'font-weight: bold')
    })

    emitter.on('suite:end', () => {
      console.groupEnd()
    })

    emitter.on('group:start', (payload) => {
      console.group(`%cGroup: ${payload.title}`, 'font-weight: bold')
    })

    emitter.on('group:end', () => {
      console.groupEnd()
    })

    emitter.on('test:end', (payload) => {
      if (payload.hasError) {
        console.group(`%c✖ ${payload.title.expanded}`, 'color: #D32F2F')
        if (payload.errors && payload.errors.length) {
          payload.errors.forEach(({ error }) => {
            console.error(error)
          })
        }
        console.groupEnd()
      } else if (payload.isSkipped || payload.isTodo) {
        console.log(`%c⏸ ${payload.title.expanded}`, 'color: #3d4149')
      } else {
        console.log(`%c✔ ${payload.title.expanded}`, 'color: #1B5E20')
      }
    })

    emitter.on('runner:import_error', (payload) => {
      console.group(`%c✖ Import Error: ${payload.file}`, 'color: #D32F2F; font-weight: bold')
      console.error(payload.error)
      console.groupEnd()
    })

    emitter.on('uncaught:exception', (payload) => {
      console.group(`%c✖ Uncaught Exception`, 'color: #D32F2F; font-weight: bold')
      console.error(payload.error)
      console.groupEnd()
    })
  }
}
