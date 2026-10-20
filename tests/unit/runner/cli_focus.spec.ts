import test from 'node:test'
import assert from 'node:assert/strict'
import { Cli } from '../../../src/runner/cli.js'
import { Emitter } from '../../../src/testing/emitter.js'
import type { RunnerEvents } from '../../../src/types.js'
import type { Orchestrator } from '../../../src/runner/orchestrator.js'

test('Cli Focus Mode and Event Filtering', async (t) => {
  await t.test('createFilteredEmitter clamps runner:start estimatedTotalFiles to 1 in focus mode', async () => {
    const orchestratorMock = {
      config: {
        filters: {
          files: ['/app/tests/a.spec.ts', '/app/tests/b.spec.ts'],
        },
      },
    } as unknown as Orchestrator

    const cli = new Cli(orchestratorMock)
    cli.focusOnFile('/app/tests/a.spec.ts')

    const nodeEmitter = new Emitter<RunnerEvents>()
    const filteredEmitter = cli.createFilteredEmitter(nodeEmitter)

    let emittedStartNode: any = null
    filteredEmitter.on('runner:start', (payload) => {
      emittedStartNode = payload
    })

    await nodeEmitter.emit('runner:start', { estimatedTotalFiles: 5 })

    assert.ok(emittedStartNode)
    assert.equal(emittedStartNode.estimatedTotalFiles, 1)
  })

  await t.test('createFilteredEmitter suppresses events for non-focused files in focus mode', async () => {
    const orchestratorMock = {
      config: {
        filters: {
          files: ['/app/tests/a.spec.ts', '/app/tests/b.spec.ts'],
        },
      },
    } as unknown as Orchestrator

    const cli = new Cli(orchestratorMock)
    cli.focusOnFile('/app/tests/a.spec.ts')

    const nodeEmitter = new Emitter<RunnerEvents>()
    const filteredEmitter = cli.createFilteredEmitter(nodeEmitter)

    const receivedTests: string[] = []
    filteredEmitter.on('test:end', (payload: any) => {
      receivedTests.push(payload.file)
    })

    await nodeEmitter.emit('test:end', { file: '/app/tests/b.spec.ts', title: { original: 'b', expanded: 'b' } } as any)
    await nodeEmitter.emit('test:end', {
      file: '/app/tests/supera.spec.ts',
      title: { original: 'supera', expanded: 'supera' },
    } as any)
    await nodeEmitter.emit('test:end', { file: '/app/tests/a.spec.ts', title: { original: 'a', expanded: 'a' } } as any)

    assert.deepEqual(receivedTests, ['/app/tests/a.spec.ts'])
  })

  await t.test('createFilteredEmitter suppresses runner:start and runner:end during background-only runs', async () => {
    const orchestratorMock = {
      config: {
        filters: {
          files: ['/app/tests/b.spec.ts', '/app/tests/c.spec.ts'],
        },
      },
    } as unknown as Orchestrator

    const cli = new Cli(orchestratorMock)
    cli.focusOnFile('/app/tests/a.spec.ts')
    // Set active filter on orchestrator to only the background files
    orchestratorMock.config.filters.files = ['/app/tests/b.spec.ts', '/app/tests/c.spec.ts']

    const nodeEmitter = new Emitter<RunnerEvents>()
    const filteredEmitter = cli.createFilteredEmitter(nodeEmitter)

    let startCalled = false
    let endCalled = false
    let testCalled = false

    filteredEmitter.on('runner:start', () => {
      startCalled = true
    })
    filteredEmitter.on('runner:end', () => {
      endCalled = true
    })
    filteredEmitter.on('test:end', () => {
      testCalled = true
    })

    await nodeEmitter.emit('runner:start', { estimatedTotalFiles: 2 })
    await nodeEmitter.emit('test:end', { file: '/app/tests/b.spec.ts', title: { original: 'b', expanded: 'b' } } as any)
    await nodeEmitter.emit('runner:end', { hasError: false })

    assert.equal(startCalled, false)
    assert.equal(endCalled, false)
    assert.equal(testCalled, false)
  })

  await t.test('buffers full suite events, browser logs, and import errors for replay', async () => {
    const orchestratorMock = {
      config: {
        filters: {
          files: ['/app/tests/a.spec.ts'],
        },
      },
    } as unknown as Orchestrator

    const cli = new Cli(orchestratorMock)
    cli.focusOnFile('/app/tests/a.spec.ts')

    const nodeEmitter = new Emitter<RunnerEvents>()
    cli.createFilteredEmitter(nodeEmitter)

    await nodeEmitter.emit('suite:start', { name: 'default', browserId: 'chromium' } as any)
    await nodeEmitter.emit('browser:log', { file: '/app/tests/b.spec.ts', messages: ['test log'] } as any)
    await nodeEmitter.emit('runner:import_error', { file: '/app/tests/c.spec.ts', error: new Error('fail') } as any)
    await nodeEmitter.emit('suite:end', { name: 'default', browserId: 'chromium', hasError: false } as any)

    const fileEvents = cli.getFileEvents()
    assert.ok(fileEvents.has('/app/tests/b.spec.ts'))
    assert.ok(fileEvents.has('/app/tests/c.spec.ts'))
    assert.equal(fileEvents.get('/app/tests/b.spec.ts')?.[0]?.eventName, 'browser:log')
    assert.equal(fileEvents.get('/app/tests/c.spec.ts')?.[0]?.eventName, 'runner:import_error')

    const suiteStarts = cli.getSuiteStartEvents()
    assert.ok(suiteStarts.has('default:chromium'))

    const suiteEnds = cli.getSuiteEndEvents()
    assert.ok(suiteEnds.has('default:chromium'))
  })

  await t.test('buffers test:start and test:end events using meta.file and replays them', async () => {
    const orchestratorMock = {
      config: {
        filters: {
          files: ['/app/tests/a.spec.ts'],
        },
      },
    } as unknown as Orchestrator

    const cli = new Cli(orchestratorMock)
    cli.focusOnFile('/app/tests/a.spec.ts')

    const nodeEmitter = new Emitter<RunnerEvents>()
    cli.createFilteredEmitter(nodeEmitter)

    // Emit test:start and test:end where file is stored on meta.file (standard TestStartNode/TestEndNode)
    await nodeEmitter.emit('test:start', {
      title: { original: 'test 1', expanded: 'test 1' },
      meta: { file: '/app/tests/b.spec.ts', suite: 'default' },
    } as any)
    await nodeEmitter.emit('test:end', {
      title: { original: 'test 1', expanded: 'test 1' },
      meta: { file: '/app/tests/b.spec.ts', suite: 'default' },
      hasError: true,
      errors: [{ error: new Error('intentional failure') }],
    } as any)

    const fileEvents = cli.getFileEvents()
    assert.ok(fileEvents.has('/app/tests/b.spec.ts'))
    const events = fileEvents.get('/app/tests/b.spec.ts')!
    assert.equal(events.length, 2)
    assert.equal(events[0].eventName, 'test:start')
    assert.equal(events[1].eventName, 'test:end')
    assert.equal(events[1].data.hasError, true)
  })

  await t.test('attributes browser:log with unknown file to current active test file', async () => {
    const orchestratorMock = {
      config: {
        filters: {
          files: ['/app/tests/a.spec.ts'],
        },
      },
    } as unknown as Orchestrator

    const cli = new Cli(orchestratorMock)
    cli.focusOnFile('/app/tests/a.spec.ts')

    const nodeEmitter = new Emitter<RunnerEvents>()
    cli.createFilteredEmitter(nodeEmitter)

    await nodeEmitter.emit('file:start', {
      file: '/app/tests/b.spec.ts',
      groups: 1,
      tests: 1,
      browserId: 'chromium',
    } as any)
    // Console log emitted from browser with unknown file location while /app/tests/b.spec.ts is running
    await nodeEmitter.emit('browser:log', {
      file: 'unknown',
      type: 'warn',
      messages: ['bounce tracker warning'],
    } as any)
    await nodeEmitter.emit('file:end', {
      file: '/app/tests/b.spec.ts',
      groups: 1,
      tests: 1,
      browserId: 'chromium',
    } as any)

    const fileEvents = cli.getFileEvents()
    assert.ok(fileEvents.has('/app/tests/b.spec.ts'))
    const bEvents = fileEvents.get('/app/tests/b.spec.ts')!
    const logEvent = bEvents.find((e) => e.eventName === 'browser:log')
    assert.ok(logEvent)
    assert.equal(logEvent.data.file, '/app/tests/b.spec.ts')
  })

  await t.test(
    'clearEventBufferFor deletes old events and logs so stale errors and duplicates are removed on revalidation',
    async () => {
      const orchestratorMock = {
        config: {
          filters: {
            files: ['/app/tests/a.spec.ts'],
          },
        },
      } as unknown as Orchestrator

      const cli = new Cli(orchestratorMock)
      cli.focusOnFile('/app/tests/a.spec.ts')

      const nodeEmitter = new Emitter<RunnerEvents>()
      cli.createFilteredEmitter(nodeEmitter)

      // Initial run of b.spec.ts produces a warning and failure
      await nodeEmitter.emit('browser:log', {
        file: '/app/tests/b.spec.ts',
        type: 'warn',
        messages: ['first warning'],
      } as any)
      await nodeEmitter.emit('test:end', {
        title: { original: 'failing test', expanded: 'failing test' },
        meta: { file: '/app/tests/b.spec.ts', suite: 'default' },
        hasError: true,
      } as any)

      assert.equal(cli.getFileEvents().get('/app/tests/b.spec.ts')?.length, 2)

      // File b is re-run (revalidated)
      cli.clearEventBufferFor(['/app/tests/b.spec.ts'])

      assert.equal(cli.getFileEvents().has('/app/tests/b.spec.ts'), false)

      // Fresh run of b produces only passing test
      await nodeEmitter.emit('test:end', {
        title: { original: 'passing test', expanded: 'passing test' },
        meta: { file: '/app/tests/b.spec.ts', suite: 'default' },
        hasError: false,
      } as any)

      assert.equal(cli.getFileEvents().get('/app/tests/b.spec.ts')?.length, 1)
      assert.equal(cli.getFileEvents().get('/app/tests/b.spec.ts')?.[0]?.data?.hasError, false)
    }
  )

  await t.test('replayCachedEventsForUnchangedFiles skips active filter files and replays other files', async () => {
    const orchestratorMock = {
      config: {
        filters: {},
      },
    } as unknown as Orchestrator

    const cli = new Cli(orchestratorMock)
    const sourceEmitter = new Emitter<RunnerEvents>()
    cli.createFilteredEmitter(sourceEmitter)

    // Buffer events for file A and file B
    await sourceEmitter.emit('file:start', { file: '/app/tests/a.spec.ts', browserId: 'chromium' } as any)
    await sourceEmitter.emit('test:end', {
      title: { original: 'a', expanded: 'a' },
      meta: { file: '/app/tests/a.spec.ts' },
    } as any)
    await sourceEmitter.emit('file:end', { file: '/app/tests/a.spec.ts', browserId: 'chromium' } as any)

    await sourceEmitter.emit('file:start', { file: '/app/tests/b.spec.ts', browserId: 'chromium' } as any)
    await sourceEmitter.emit('test:end', {
      title: { original: 'b', expanded: 'b' },
      meta: { file: '/app/tests/b.spec.ts' },
    } as any)
    await sourceEmitter.emit('file:end', { file: '/app/tests/b.spec.ts', browserId: 'chromium' } as any)

    // Replay targeting a new emitter, with active filter = [a.spec.ts] (file A changed, so only file B should replay)
    const targetEmitter = new Emitter<RunnerEvents>()
    const replayedFiles: string[] = []
    targetEmitter.on('file:start', (payload: any) => {
      replayedFiles.push(payload.file)
    })

    await cli.replayCachedEventsForUnchangedFiles(targetEmitter, ['/app/tests/a.spec.ts'])

    assert.deepEqual(replayedFiles, ['/app/tests/b.spec.ts'])
  })

  await t.test(
    'clearEventBufferFor and replayCachedEventsForUnchangedFiles avoid false substring collisions',
    async () => {
      const orchestratorMock = {
        config: {
          filters: {},
        },
      } as unknown as Orchestrator

      const cli = new Cli(orchestratorMock)
      const sourceEmitter = new Emitter<RunnerEvents>()
      cli.createFilteredEmitter(sourceEmitter)

      // Buffer events for file.spec.ts and superfile.spec.ts
      await sourceEmitter.emit('file:start', { file: '/app/tests/file.spec.ts', browserId: 'chromium' } as any)
      await sourceEmitter.emit('file:end', { file: '/app/tests/file.spec.ts', browserId: 'chromium' } as any)
      await sourceEmitter.emit('file:start', { file: '/app/tests/superfile.spec.ts', browserId: 'chromium' } as any)
      await sourceEmitter.emit('file:end', { file: '/app/tests/superfile.spec.ts', browserId: 'chromium' } as any)

      assert.equal(cli.getFileEvents().has('/app/tests/file.spec.ts'), true)
      assert.equal(cli.getFileEvents().has('/app/tests/superfile.spec.ts'), true)

      // Clearing file.spec.ts must NOT clear superfile.spec.ts
      cli.clearEventBufferFor(['file.spec.ts'])
      assert.equal(cli.getFileEvents().has('/app/tests/file.spec.ts'), false)
      assert.equal(cli.getFileEvents().has('/app/tests/superfile.spec.ts'), true)

      // Replay with active filter 'file.spec.ts' must replay 'superfile.spec.ts'
      const targetEmitter = new Emitter<RunnerEvents>()
      const replayed: string[] = []
      targetEmitter.on('file:start', (p: any) => {
        replayed.push(p.file)
      })
      await cli.replayCachedEventsForUnchangedFiles(targetEmitter, ['file.spec.ts'])
      assert.deepEqual(replayed, ['/app/tests/superfile.spec.ts'])
    }
  )
})
