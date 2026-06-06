/* eslint-disable no-console */
/// <reference types="vite/client" />
import { WebRunner } from './web_runner.js'
import { Suite } from './suite/main.js'
import { Emitter } from './emitter.js'
import { Refiner } from '../refiner/main.js'
import { setActiveInstances, setActiveFile } from './api.js'
import { BrowserExceptionsManager } from './exceptions_manager.js'
import type { WebPluginContext } from './web_plugin.js'
import { EventManager } from './event_manager.js'
import { BrowserReporter } from './browser_reporter.js'
import debug from './debug.js'

// We expect window.__lupa__ to be injected by the Node.js runner
declare global {
  interface Window {
    /**
     * Injected configuration and metadata payload from the Node.js test runner.
     */
    __lupa__: {
      /**
       * Test suites to be initialized and executed in the browser.
       */
      suites: {
        /** Name of the suite */
        name: string
        /** Default timeout override for tests in this suite (in milliseconds) */
        timeout?: number
        /** Default retries override for tests in this suite */
        retries?: number
        /** Array of test file paths to resolve and execute */
        files: string[]
      }[]
      /**
       * Global runner configuration settings.
       */
      config: {
        /** Global test timeout limit in milliseconds */
        timeout?: number
        /** Global test retries limit */
        retries?: number
        /** Query filters used by the Refiner to include/exclude specific tests */
        filters?: any
        /** If true, the runner lists suite and test files instead of executing them */
        list?: boolean
      }
      /** Configured test plugins to import and register */
      testPlugins?: (string | [string, any])[]
      /** Unique ID for the current execution batch/chunk */
      chunkId?: string
      /** Name of the active browser executing this test (e.g., 'chromium', 'firefox', 'webkit') */
      browserName?: string
    }
    /**
     * Callback/RPC method triggered by the harness when all tests have finished execution,
     * signaling completion back to the Node.js runner process.
     */
    __lupa_runner_end__: () => Promise<void>
    /**
     * Boolean flag indicating whether the runner is executing under test/CI mode.
     */
    __lupa_testing_mode__?: boolean
  }

  // Lit stores its issued warnings here
  var litIssuedWarnings: Set<string> | undefined
}

export async function boot() {
  debug('Booting Lupa harness')
  // Suppress Lit dev-mode warnings in testing environment
  globalThis.litIssuedWarnings ??= new Set()
  globalThis.litIssuedWarnings.add('dev-mode')

  const emitter = new Emitter()
  const runner = new WebRunner(emitter)
  const refiner = new Refiner(window.__lupa__.config?.filters || {})

  const isDebug = new URLSearchParams(window.location.search).get('debug') === '1'

  if (isDebug) {
    debug('Starting browser reporter')
    const reporter = new BrowserReporter()
    reporter.boot(emitter as any)
  } else {
    debug('Starting event manager')
    const eventManager = new EventManager(emitter, import.meta.hot)
    eventManager.boot()
  }

  // Start exception manager early so we catch plugin and suite load errors
  const exceptionsManager = new BrowserExceptionsManager(emitter)
  exceptionsManager.monitor()

  // Load test plugins before suites
  const pluginContext: WebPluginContext = { runner, emitter, config: window.__lupa__.config }
  const testPlugins = window.__lupa__.testPlugins || []
  debug('Loading test plugins...')
  for (const entry of testPlugins) {
    const [specifier, options] = Array.isArray(entry) ? entry : [entry, undefined]
    try {
      const mod = await import(/* @vite-ignore */ specifier)
      if (typeof mod.default === 'function') {
        await mod.default(pluginContext, options)
      } else {
        console.warn(`Test plugin "${specifier}" does not have a default export`)
      }
    } catch (error) {
      const msg = `Failed to load test plugin: ${specifier}`
      console.error(msg, error)
      const importError = error instanceof Error ? error : new Error(String(error))
      importError.message = `${msg}\n${importError.message}`
      emitter.emit('uncaught:exception', { error: importError, type: 'error' })
    }
  }
  debug('test plugins loaded')

  // Iterate over suites configured by the planner
  const suites = window.__lupa__.suites || []
  debug('Loading test suites...')
  for (const suiteDef of suites) {
    const suite = new Suite(suiteDef.name, suiteDef.files, emitter, refiner)
    runner.add(suite)

    const { timeout, retries } = suiteDef

    if (typeof timeout === 'number') {
      suite.onTest((test) => test.timeout(timeout))
      suite.onGroup((group) => group.each.timeout(timeout))
    }

    if (typeof retries === 'number') {
      suite.onTest((test) => test.retry(retries))
      suite.onGroup((group) => group.each.retry(retries))
    }
    setActiveInstances(runner, suite, emitter, refiner)

    // Dynamically import all test files for this suite
    for (const file of suiteDef.files) {
      try {
        setActiveFile(file)
        const prefix = window.__lupa_testing_mode__ ? 'file://' : '/@fs'
        await import(/* @vite-ignore */ prefix + file)
      } catch (error) {
        const importError = error instanceof Error ? error : new Error(String(error))
        importError.message = `Failed to load test file: ${file}\n${importError.message}`
        emitter.emit('runner:import_error', { file, error: importError })
        // Mark runner as failed so the process will eventually exit with an error
        Object.defineProperty(runner, 'failed', { get: () => true })
      } finally {
        setActiveFile(undefined)
      }
    }
  }

  debug('test suites loaded')
  // Execute the runner
  debug('Starting runner')
  await runner.start()
  debug('Runner started')
  await runner.exec()
  debug('Runner executed')
  await runner.end()
  debug('Runner ended')

  // Give Vite's WebSocket a moment to flush any final telemetry (like import errors or runner:end)
  await new Promise((resolve) => setTimeout(resolve, 50))

  // Notify Node.js that we are done
  if (window.__lupa_runner_end__ && !isDebug) {
    await window.__lupa_runner_end__()
  }
}

if (typeof window !== 'undefined' && !window.__lupa_testing_mode__) {
  boot().catch(console.error)
}
