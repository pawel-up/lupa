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

// We expect window.__lupa__ to be injected by the Node.js runner
declare global {
  interface Window {
    __lupa__: {
      suites: {
        name: string
        timeout?: number
        retries?: number
        files: string[]
      }[]
      config: {
        timeout?: number
        retries?: number
        filters?: any
        list?: boolean
      }
      testPlugins?: (string | [string, any])[]
    }
    __lupa_runner_end__: () => Promise<void>
    __lupa_testing_mode__?: boolean
  }

  // Lit stores its issued warnings here
  var litIssuedWarnings: Set<string> | undefined
}

export async function boot() {
  // Suppress Lit dev-mode warnings in testing environment
  globalThis.litIssuedWarnings ??= new Set()
  globalThis.litIssuedWarnings.add('dev-mode')

  const emitter = new Emitter()
  const runner = new WebRunner(emitter)
  const refiner = new Refiner(window.__lupa__.config?.filters || {})

  const isDebug = new URLSearchParams(window.location.search).get('debug') === '1'

  if (!isDebug) {
    const eventManager = new EventManager(emitter, import.meta.hot)
    eventManager.boot()
  }

  // Start exception manager early so we catch plugin and suite load errors
  const exceptionsManager = new BrowserExceptionsManager(emitter)
  exceptionsManager.monitor()

  // Load test plugins before suites
  const pluginContext: WebPluginContext = { runner, emitter, config: window.__lupa__.config }
  const testPlugins = window.__lupa__.testPlugins || []
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

  // Iterate over suites configured by the planner
  const suites = window.__lupa__.suites || []
  for (const suiteDef of suites) {
    const suite = new Suite(suiteDef.name, emitter, refiner)
    suite.filesCount = suiteDef.files.length
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
        console.error(importError.message, importError)
        emitter.emit('uncaught:exception', { error: importError, type: 'error' })
      } finally {
        setActiveFile(undefined)
      }
    }
  }
  // Execute the runner
  await runner.start()
  await runner.exec()
  await runner.end()

  // Notify Node.js that we are done
  if (window.__lupa_runner_end__ && !isDebug) {
    await window.__lupa_runner_end__()
  }
}

if (typeof window !== 'undefined' && !window.__lupa_testing_mode__) {
  boot().catch(console.error)
}
