import type { CleanupHandler, HookHandler } from './hooks/types.js'
import type { AssertionError } from 'assertion-error'

import type { Test } from './testing/test/main.js'
import type { Group } from './testing/group/main.js'
import type { Suite } from './testing/suite/main.js'
import type { Emitter } from './testing/emitter.js'
import type { NormalizedConfig, TestSuite } from './runner/types.js'
import type { Runner } from './runner/runner.js'
import type { TestContext } from './testing/test_context.js'

export type { Runner }

/**
 * One of the predefined types of errors that can happen during test execution
 */
export type TestError = AssertionError<unknown> | Error

/**
 * Summary reporters are registered with the SummaryBuilder to
 * add information to the tests summary output
 */
export type SummaryReporter = () => { key: string; value: string | string[] }[]

/**
 * Shape of test data set. Should be an array of a function that
 * returns an array
 */
export type DataSetNode = undefined | any[] | (() => any[] | Promise<any[]>)

/**
 * The data given to the setup and the teardown test
 * hooks
 */
export type TestHooksData = [[test: Test<any>], [hasError: boolean, test: Test<any>]]

/**
 * The function that can be registered as a test hook
 */
export type TestHooksHandler = HookHandler<TestHooksData[0], TestHooksData[1]>

/**
 * The function that can be registered as a cleanup handler
 */
export type TestHooksCleanupHandler = CleanupHandler<TestHooksData[1]>

/**
 * Hooks available on a test
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type TestHooks = {
  /**
   * Setup hook
   */
  setup: TestHooksData
  /**
   * Teardown hook
   */
  teardown: TestHooksData
  /**
   * Cleanup hook
   */
  cleanup: [TestHooksData[1], []]
}

/**
 * The data given to the setup and the teardown group
 * hooks
 */
export type GroupHooksData = [[group: Group], [hasError: boolean, group: Group]]

/**
 * The callback function given to the "setup" and the "teardown"
 * methods on a group
 */
export type GroupHooksHandler = HookHandler<GroupHooksData[0], GroupHooksData[1]>

/**
 * Hooks available on a group
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type GroupHooks = {
  /**
   * Setup hook
   */
  setup: GroupHooksData
  /**
   * Teardown hook
   */
  teardown: GroupHooksData
}

/**
 * The data given to the setup and the teardown suite
 * hooks
 */
export type SuiteHooksData = [[suite: Suite], [hasError: boolean, suite: Suite]]

/**
 * The function that can be registered as a suite hook
 */
export type SuiteHooksHandler = HookHandler<SuiteHooksData[0], SuiteHooksData[1]>

/**
 * Hooks available on a suite
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type SuiteHooks = {
  /**
   * Setup hook
   */
  setup: SuiteHooksData
  /**
   * Teardown hook
   */
  teardown: SuiteHooksData
}

/**
 * A test suite that has been planned, with the filesURLs.
 */
export type PlannedTestSuite = TestSuite & { filesURLs: URL[] }

/**
 * The function to execute the test
 */
export type TestExecutor<DataSet> = DataSet extends any[]
  ? (context: TestContext, value: DataSet[number], done: (error?: any) => void) => void | Promise<void>
  : DataSet extends () => infer A
    ? (
        context: TestContext,
        value: Awaited<A> extends any[] ? Awaited<A>[number] : Awaited<A>,
        done?: (error?: any) => void
      ) => void | Promise<void>
    : (context: TestContext, done: (error?: any) => void) => void | Promise<void>

/**
 * Test configuration options.
 */
export interface TestOptions {
  /**
   * Test title
   */
  title: string
  /**
   * Test tags
   */
  tags: string[]
  /**
   * Test timeout
   */
  timeout: number
  /**
   * Whether the test waits for done
   */
  waitsForDone?: boolean
  /**
   * Test executor
   */
  executor?: TestExecutor<any>
  /**
   * Whether the test is a todo
   */
  isTodo?: boolean
  /**
   * Whether the test is skipped
   */
  isSkipped?: boolean
  /**
   * Whether the test is failing
   */
  isFailing?: boolean
  /**
   * Skip reason
   */
  skipReason?: string
  /**
   * Fail reason
   */
  failReason?: string
  /**
   * Number of retries
   */
  retries?: number
  /**
   * Retry attempt number
   */
  retryAttempt?: number
  /**
   * Test metadata
   */
  meta: TestMetadata
}

/**
 * Data shared during "test:start" event
 */
export type TestStartNode = Omit<TestOptions, 'title'> & {
  /**
   * Test title
   */
  title: {
    /**
     * Original title
     */
    original: string
    /**
     * Expanded title
     */
    expanded: string
  }
  /**
   * Whether the test is pinned
   */
  isPinned: boolean
  /**
   * Dataset information
   */
  dataset?: {
    /**
     * Dataset size
     */
    size: number
    /**
     * Dataset index
     */
    index: number
    /**
     * Dataset row
     */
    row: any
  }
  /**
   * Test metadata
   */
  meta: TestMetadata
}

/**
 * Common correlation IDs for parallel telemetry
 */
export interface CorrelationIds {
  /**
   * Browser ID
   */
  browserId: string
  /**
   * File path.
   * Note, for the `suite:*` event, this will be set to `unknown` as the suite can contain multiple files.
   */
  file: string
}

/**
 * A type that adds correlation IDs to a type.
 * These are used with log reporting.
 */
export type WithCorrelation<T> = T & CorrelationIds

/**
 * Data shared during "test:end" event
 */
export type TestEndNode = Omit<TestOptions, 'title'> & {
  /**
   * Test title
   */
  title: {
    /**
     * Original title
     */
    original: string
    /**
     * Expanded title
     */
    expanded: string
  }
  /**
   * Whether the test is pinned
   */
  isPinned: boolean
  /**
   * Test duration in milliseconds
   */
  duration: number
  /**
   * Whether the test has any errors
   */
  hasError: boolean
  /**
   * Errors that occurred during the test execution
   */
  errors: {
    /**
     * Phase in which the error occurred
     */
    phase: 'setup' | 'test' | 'setup:cleanup' | 'teardown' | 'teardown:cleanup' | 'test:cleanup'
    /**
     * The error that occurred
     */
    error: TestError
  }[]
  /**
   * Retry attempt number
   */
  retryAttempt?: number
  /**
   * Dataset information
   */
  dataset?: {
    /**
     * Dataset size
     */
    size: number
    /**
     * Dataset index
     */
    index: number
    /**
     * Dataset row
     */
    row: any
  }
}

/**
 * The metadata object associated with a group events.
 */
export interface GroupMetadata {
  /**
   * File path in which the group is defined
   */
  file: string
  /**
   * Suite name in which the group is defined.
   * It is safe to assume that a group is always defined inside a suite,
   * even when not using test suites, as a "default" suite is created to hold all tests.
   */
  suite: string
}

/**
 * The metadata object associated with a test events.
 */
export interface TestMetadata {
  /**
   * File path in which the test is defined
   */
  file: string
  /**
   * Suite name in which the test is defined
   * It is safe to assume that a test is always defined inside a suite,
   * even when not using test suites, as a "default" suite is created to hold all tests.
   */
  suite: string
  /**
   * Group name in which the test is defined
   */
  group?: string
  /**
   * Abort the test if the condition is met
   */
  abort?: (message: string) => any
}

/**
 * Group options
 */
export interface GroupOptions {
  /**
   * Group title
   */
  title: string
  /**
   * Group metadata
   */
  meta: GroupMetadata
}

/**
 * File start node shared during "file:start" event
 */
export interface FileStartNode {
  /**
   * File path
   */
  file: string
  /**
   * The number of groups in the file
   */
  groups: number
  /**
   * The number of tests in the file
   */
  tests: number
}

/**
 * File end node shared during "file:end" event
 */
export interface FileEndNode {
  /**
   * File path
   */
  file: string
  /**
   * The number of groups executed in the file
   */
  groups: number
  /**
   * The number of tests executed in the file
   */
  tests: number
}

/**
 * Data shared with "group:start" event
 */
export type GroupStartNode = GroupOptions

/**
 * Data shared with "group:end" event
 */
export type GroupEndNode = GroupOptions & {
  /**
   * Whether the group has any errors
   */
  hasError: boolean
  /**
   * Errors that occurred during the group execution
   */
  errors: {
    phase: 'setup' | 'setup:cleanup' | 'teardown' | 'teardown:cleanup'
    error: TestError
  }[]
}

/**
 * Data shared with "suite:start" event
 */
export interface SuiteStartNode {
  /**
   * Suite name
   */
  name: string
  /**
   * Number of files in the suite
   */
  filesCount?: number
  /**
   * File paths of the files in the suite. This can be used for grouping logs and errors in the reporter output.
   */
  files: string[]
}

/**
 * Data shared with "suite:end" event
 */
export interface SuiteEndNode {
  /**
   * Suite name
   */
  name: string
  /**
   * Number of files in the suite
   */
  filesCount?: number
  /**
   * File paths of the files in the suite. This can be used for grouping logs and errors in the reporter output.
   */
  files: string[]
  /**
   * Whether the suite has any errors
   */
  hasError: boolean
  /**
   * Errors that occurred during the suite execution
   */
  errors: {
    phase: 'setup' | 'setup:cleanup' | 'teardown' | 'teardown:cleanup'
    error: TestError
  }[]
}

/**
 * Data shared with "runner:start" event
 */
export interface RunnerStartNode {
  /**
   * The number of total files that should be tested.
   * Used for progress reporting.
   */
  estimatedTotalFiles: number
}

/**
 * Data shared with "runner:end" event
 */
export interface RunnerEndNode {
  /**
   * Whether the runner has any errors
   */
  hasError: boolean
}

/**
 * Options for filtering and running on selected tests
 */
export interface FilteringOptions {
  /**
   * Test tags to filter by
   */
  tags?: string[]
  /**
   * Test groups to filter by
   */
  groups?: string[]
  /**
   * Test names to filter by
   */
  tests?: string[]
}

/**
 * Runner import error
 */
export interface RunnerImportErrorNode {
  /**
   * The file that failed to import
   */
  file: string
  /**
   * The error that occurred
   */
  error: TestError
  /**
   * Browser ID where the error occurred
   */
  browserId?: string
}

/**
 * Uncaught exception
 */
export interface UncaughtExceptionNode {
  /**
   * The error that occurred
   */
  error: TestError
  /**
   * Type of exception
   */
  type: 'error' | 'rejection'
}

/**
 * Test node inside the test discovery list tree.
 */
export interface RunnerListTestNode {
  /** The title of the test. */
  title: string
  /** An array of tags assigned to the test. */
  tags: string[]
  /** The timeout for the test execution in milliseconds. */
  timeout: number
  /** The number of retries configured for the test, if any. */
  retries?: number
  /** Whether the test has been marked as skipped. */
  isSkipped: boolean
  /** Whether the test has been marked as a TODO. */
  isTodo: boolean
  /** Metadata associated with the test, such as its location. */
  meta: TestMetadata
  /** Whether the test is pinned. */
  isPinned?: boolean
}

/**
 * Group node inside the test discovery list tree.
 */
export interface RunnerListGroupNode {
  /** The title of the test group. */
  title: string
  /** A collection of tests directly within this group. */
  tests: RunnerListTestNode[]
  /** A collection of nested groups within this group. */
  groups: RunnerListGroupNode[]
}

/**
 * Suite node inside the test discovery list tree.
 */
export interface RunnerListSuiteNode {
  /** The name of the test suite. */
  name: string
  /** A collection of test groups belonging to this suite. */
  groups: RunnerListGroupNode[]
  /** A collection of tests directly belonging to this suite (not inside any group). */
  tests: RunnerListTestNode[]
  /**
   * The list of files in the suite. This is used by the progress reporter to track which files are being executed.
   */
  files: string[]
}

/**
 * Data payload shared with the "runner:list" telemetry event.
 */
export interface RunnerListNode {
  /** A collection of all suites discovered during the dry-run. */
  suites: RunnerListSuiteNode[]
}

/**
 * Extension point for custom events shared across the browser and Node emitters.
 *
 * Third-party plugins can add typed events by augmenting this interface via declaration merging.
 * A single augmentation gives full type safety on both sides:
 * - the `emitter` in `WebPluginFn` (browser, emit side)
 * - the `emitter` in `LupaPlugin.execute()` (Node, subscribe side)
 *
 * ```typescript
 * declare module '@pawel-up/lupa/testing/api' {
 *   interface CustomRunnerEvents {
 *     'benchmark:result': { name: string; duration: number }
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CustomRunnerEvents {}

/**
 * Events emitted natively by the test framework without correlation IDs.
 * Also includes custom events registered via `CustomRunnerEvents`, so browser-side
 * plugins can emit typed custom events on the same emitter they receive in `WebPluginContext`.
 */
export interface FrameworkEvents extends CustomRunnerEvents {
  /**
   * Emitted when a test starts.
   */
  'test:start': TestStartNode
  /**
   * Emitted when a test ends.
   */
  'test:end': TestEndNode
  /**
   * Emitted when a group starts.
   */
  'group:start': GroupStartNode
  /**
   * Emitted when a group ends.
   */
  'group:end': GroupEndNode
  /**
   * Emitted when a suite starts.
   */
  'suite:start': SuiteStartNode
  /**
   * Emitted when a suite ends.
   */
  'suite:end': SuiteEndNode
  /**
   * Emitted when an uncaught exception occurs.
   */
  'uncaught:exception': UncaughtExceptionNode
  /**
   * Emitted when the runner is in list mode and dumps the test tree
   */
  'runner:list': RunnerListNode
  /**
   * Emitted when the runner starts.
   */
  'runner:start': RunnerStartNode
  /**
   * Emitted when the runner ends.
   */
  'runner:end': RunnerEndNode
  /**
   * Emitted when a test file fails to import
   */
  'runner:import_error': RunnerImportErrorNode
  /**
   * Emitted when a test file starts being processed
   */
  'file:start': FileStartNode
  /**
   * Emitted when a test file finished all tests execution
   */
  'file:end': FileEndNode
}

/**
 * Events emitted by the browser telemetry over WebSocket.
 * The augmentation happens in the src/testing/event_manager.ts file, where the correlation IDs
 * are added to the events emitted by the framework.
 */
export interface BrowserTelemetryEvents {
  /**
   * Emitted when a test starts.
   */
  'test:start': WithCorrelation<TestStartNode>
  /**
   * Emitted when a test ends.
   */
  'test:end': WithCorrelation<TestEndNode>
  /**
   * Emitted when a group starts.
   */
  'group:start': WithCorrelation<GroupStartNode>
  /**
   * Emitted when a group ends.
   */
  'group:end': WithCorrelation<GroupEndNode>
  /**
   * Emitted when a suite starts.
   */
  'suite:start': WithCorrelation<SuiteStartNode>
  /**
   * Emitted when a suite ends.
   */
  'suite:end': WithCorrelation<SuiteEndNode>
  /**
   * Emitted when an uncaught exception occurs.
   */
  'uncaught:exception': UncaughtExceptionNode & Partial<CorrelationIds>
  /**
   * Emitted when the runner is in list mode and dumps the test tree
   */
  'runner:list': RunnerListNode & Partial<CorrelationIds>
  /**
   * Emitted when the runner starts.
   */
  'runner:start': RunnerStartNode & Partial<CorrelationIds>
  /**
   * Emitted when the runner ends.
   */
  'runner:end': RunnerEndNode & Partial<CorrelationIds>
  /**
   * Emitted when a test file fails to import
   */
  'runner:import_error': RunnerImportErrorNode & Partial<CorrelationIds>
  /**
   * Emitted when a test file starts being processed
   */
  'file:start': WithCorrelation<FileStartNode>
  /**
   * Emitted when a test file finished all tests execution
   */
  'file:end': WithCorrelation<FileEndNode>
}

/**
 * Events emitted by the Node runner orchestrator.
 * Includes hydrated browser events, pool lifecycle events, and any custom events
 * registered via `CustomRunnerEvents`.
 */
export interface RunnerEvents extends BrowserTelemetryEvents, CustomRunnerEvents {
  /**
   * Browser console log
   */
  'browser:log': {
    file: string
    type: string
    messages: any[]
  }
}

/**
 * Type for the reporter handler function
 */
export type ReporterHandlerContract = (
  runner: Runner,
  emitter: Emitter<RunnerEvents>,
  config: NormalizedConfig
) => void | Promise<void>

/**
 * Type for a named reporter object.
 */
export interface NamedReporterContract {
  /**
   * Reporter name
   */
  readonly name: string
  /**
   * Whether the reporter takes exclusive control of the CLI output.
   * If true, only one such reporter can be active at a time to prevent interleaved output.
   */
  readonly usesCLI?: boolean
  /**
   * Reporter handler
   */
  handler: ReporterHandlerContract
}

/**
 * An extension of NamedReporterContract that allows the reporter to be used programmatically
 * to return a typed result instead of just printing to stdout.
 */
export interface ProgrammaticReporterContract<T> extends NamedReporterContract {
  /** Set to true by the framework when executing programmatically to suppress stdout. */
  isProgrammatic?: boolean
  /** Returns the parsed result */
  getResult(): T | Promise<T>
}

/**
 * Test reporters must adhere to the following contract
 */
export type ReporterContract = ReporterHandlerContract | NamedReporterContract

/**
 * The test node inside the failure tree
 */
export interface FailureTreeTestNode {
  /**
   * Test title
   */
  title: string
  /**
   * Test type
   */
  type: 'test'
  /**
   * Test errors
   */
  errors: TestEndNode['errors']
  /**
   * Browser ID where the error occurred
   */
  browserId?: string
}

/**
 * The group node inside the failure tree
 */
export interface FailureTreeGroupNode {
  /**
   * Group name
   */
  name: string
  /**
   * Group type
   */
  type: 'group'
  /**
   * Group errors
   */
  errors: GroupEndNode['errors']
  /**
   * Group children
   */
  children: FailureTreeTestNode[]
  /**
   * Browser ID where the error occurred
   */
  browserId?: string
}

/**
 * The suite node inside the failure tree
 */
export interface FailureTreeSuiteNode {
  /**
   * Suite name
   */
  name: string
  /**
   * Suite type
   */
  type: 'suite'
  /**
   * Suite errors
   */
  errors: SuiteEndNode['errors']
  /**
   * Suite children
   */
  children: (FailureTreeTestNode | FailureTreeGroupNode)[]
  /**
   * Browser ID where the error occurred
   */
  browserId?: string
}

/**
 * Runner summary properties
 */
export interface RunnerSummary {
  /**
   * Test aggregates
   */
  aggregates: {
    /**
     * Total tests
     */
    total: number
    /**
     * Failed tests
     */
    failed: number
    /**
     * Passed tests
     */
    passed: number
    /**
     * Regression tests
     */
    regression: number
    /**
     * Skipped tests
     */
    skipped: number
    /**
     * Todo tests
     */
    todo: number
  }
  /**
   * Total duration in milliseconds
   */
  duration: number
  /**
   * Whether the runner has any errors
   */
  hasError: boolean
  /**
   * Failure tree
   */
  failureTree: FailureTreeSuiteNode[]
  /**
   * Failed tests titles
   */
  failedTestsTitles: string[]
  /**
   * Import errors that occurred when loading test files
   */
  importErrors: RunnerImportErrorNode[]
}

/**
 * Base reporter options
 */
export interface BaseReporterOptions {
  /**
   * Maximum number of frames to capture
   */
  framesMaxLimit?: number
}
