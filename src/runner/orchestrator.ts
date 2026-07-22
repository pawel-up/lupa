import { type ViteDevServer } from 'vite'
import { Emitter } from '../testing/emitter.js'
import type { RunnerEvents } from '../types.js'
import { Runner } from './runner.js'
import { ExceptionsManager } from './exceptions_manager.js'
import { BrowserManager, type BrowserName } from './browser_manager.js'
import { ServerManager, type ServerTelemetryContract } from './server_manager.js'
import { TestPoolManager } from './test_pool_manager.js'
import { Cli } from './cli.js'
import type { NormalizedConfig, CLIArgs } from './types.js'
import type { NamedReporterContract } from '../types.js'
import { Telemetry } from './telemetry.js'
import { LifecycleManager, type ShutdownOptions } from './lifecycle_manager.js'
import { TestExecutor } from './test_executor.js'

/**
 * The `Orchestrator` is the primary coordinator of the Lupa test framework.
 * Delegates environment startup and teardown to `LifecycleManager`, and
 * test execution and wave processing to `TestExecutor`.
 */
export class Orchestrator implements ServerTelemetryContract {
  public exceptionsManager: ExceptionsManager
  public browserNames: BrowserName[]
  public cli: Cli
  public telemetry: Telemetry
  public lifecycle: LifecycleManager
  public executor: TestExecutor

  public isShuttingDown = false

  #completionPromise?: Promise<number>
  #resolveCompletion?: (code: number) => void
  #rejectCompletion?: (error: any) => void

  constructor(
    public config: NormalizedConfig,
    public cliArgs: CLIArgs,
    public reporters: NamedReporterContract[],
    public suites: any[],
    public refinerFilters: any[]
  ) {
    const rawBrowsers = cliArgs.browser || ['chromium']
    this.browserNames = (Array.isArray(rawBrowsers) ? rawBrowsers : [rawBrowsers]) as BrowserName[]
    this.exceptionsManager = new ExceptionsManager()

    this.cli = new Cli(this)
    this.telemetry = new Telemetry(this)
    this.lifecycle = new LifecycleManager(this)
    this.executor = new TestExecutor(this)
  }

  public get vite(): ViteDevServer | undefined {
    return this.lifecycle.vite
  }
  public set vite(val: ViteDevServer | undefined) {
    this.lifecycle.vite = val
  }

  public get serverManager(): ServerManager | undefined {
    return this.lifecycle.serverManager
  }
  public set serverManager(val: ServerManager | undefined) {
    this.lifecycle.serverManager = val
  }

  public get browserManager(): BrowserManager | undefined {
    return this.lifecycle.browserManager
  }
  public set browserManager(val: BrowserManager | undefined) {
    this.lifecycle.browserManager = val
  }

  public get poolManager(): TestPoolManager | undefined {
    return this.lifecycle.poolManager
  }
  public set poolManager(val: TestPoolManager | undefined) {
    this.lifecycle.poolManager = val
  }

  public get browserEmitter(): Emitter<RunnerEvents> {
    return this.lifecycle.browserEmitter
  }
  public set browserEmitter(val: Emitter<RunnerEvents>) {
    this.lifecycle.browserEmitter = val
  }

  public get serverUrl(): string | undefined {
    return this.lifecycle.serverUrl
  }
  public set serverUrl(val: string | undefined) {
    this.lifecycle.serverUrl = val
  }

  public get isRunning(): boolean {
    return this.executor.isRunning
  }
  public set isRunning(val: boolean) {
    this.executor.isRunning = val
  }

  public get activeNodeRunner(): Runner | undefined {
    return this.executor.activeNodeRunner
  }
  public set activeNodeRunner(val: Runner | undefined) {
    this.executor.activeNodeRunner = val
  }

  public get activeNodeEmitter(): Emitter<RunnerEvents> | undefined {
    return this.executor.activeNodeEmitter
  }
  public set activeNodeEmitter(val: Emitter<RunnerEvents> | undefined) {
    this.executor.activeNodeEmitter = val
  }

  public get globalTimeout(): ReturnType<typeof setTimeout> | undefined {
    return this.executor.globalTimeout
  }
  public set globalTimeout(val: ReturnType<typeof setTimeout> | undefined) {
    this.executor.globalTimeout = val
  }

  public get isWatchMode(): boolean {
    return this.cliArgs.watch === true
  }

  public get defaultBrowserType(): BrowserName {
    return this.browserNames[0]
  }

  /**
   * Register teardown functions from plugins (e.g. from the plan phase).
   */
  public registerTeardowns(teardowns: (() => void | Promise<void>)[]): void {
    this.lifecycle.registerTeardowns(teardowns)
  }

  /**
   * Returns a promise that resolves with the exit code when the test run completes.
   */
  public async waitForCompletion(): Promise<number> {
    if (!this.#completionPromise) {
      this.#completionPromise = new Promise((resolve, reject) => {
        this.#resolveCompletion = resolve
        this.#rejectCompletion = reject
      })
    }
    return this.#completionPromise
  }

  /**
   * Resolves the completion promise with the given exit code.
   * @internal
   */
  public resolveCompletion(code: number): void {
    if (this.#resolveCompletion) {
      this.#resolveCompletion(code)
    }
  }

  /**
   * Rejects the completion promise with the given error.
   * @internal
   */
  public rejectCompletion(error: any): void {
    if (this.#rejectCompletion) {
      this.#rejectCompletion(error)
    }
  }

  /**
   * Boots the test environment via LifecycleManager.
   */
  public async boot(): Promise<void> {
    await this.lifecycle.boot()
  }

  /**
   * Shuts down the entire test environment via LifecycleManager.
   */
  public async shutdown(exitCode: number, options: ShutdownOptions = {}): Promise<void> {
    await this.lifecycle.shutdown(exitCode, options)
  }

  /**
   * Executes the test suites via TestExecutor.
   */
  public async executeTests(): Promise<void> {
    await this.executor.execute()
  }

  /**
   * Handles Vite compilation errors.
   */
  public async handleCompilationError(error: Error, bail: boolean): Promise<void> {
    this.exceptionsManager.notifyException(error)
    if (bail) {
      if (this.#rejectCompletion) {
        this.#rejectCompletion(error)
      } else {
        await this.shutdown(1)
      }
    }
  }
}
