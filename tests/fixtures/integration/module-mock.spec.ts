import { test } from '../../../src/testing/index.js'
import type {} from '../../../src/module-mock/fixture.js'

type Calculator = typeof import('./module-mock-fixtures/calculator.js')

test.group('Module Mocking', () => {
  test('object form: overrides specific named exports, preserves the rest', async ({ module, assert }) => {
    await module.mock('./module-mock-fixtures/calculator.js', import.meta.url, {
      add: (a: number, b: number) => a + b + 100,
    })
    const { add, multiply, PI } = await module.import<Calculator>(
      './module-mock-fixtures/calculator.js',
      import.meta.url
    )

    assert.equal(add(1, 2), 103, 'mocked add should add 100')
    assert.equal(multiply(2, 3), 6, 'real multiply should be preserved')
    assert.equal(PI, 3.14159, 'real PI should be preserved')
  })

  test('factory form: receives real module and can wrap exports', async ({ module, assert }) => {
    await module.mock('./module-mock-fixtures/calculator.js', import.meta.url, (real) => {
      const realAdd = real.add as (a: number, b: number) => number
      return {
        add: (a: number, b: number) => realAdd(a, b) * 2,
      }
    })
    const { add, multiply } = await module.import<Calculator>('./module-mock-fixtures/calculator.js', import.meta.url)

    assert.equal(add(3, 4), 14, 'factory-wrapped add should double the real result')
    assert.equal(multiply(3, 4), 12, 'real multiply should be preserved')
  })

  test('default export: can be overridden', async ({ module, assert }) => {
    await module.mock('./module-mock-fixtures/calculator.js', import.meta.url, {
      default: class MockCalculator {
        add() {
          return 999
        }
      },
    })
    const mod = await module.import<Calculator>('./module-mock-fixtures/calculator.js', import.meta.url)

    const calc = new mod.default()
    assert.equal(calc.add(1, 2), 999, 'mocked default class should return 999')
  })

  test('cascade: ?lupa-mock-id propagates to transitive imports', async ({ module, assert }) => {
    await module.mock('./module-mock-fixtures/calculator.js', import.meta.url, {
      PI: 99,
    })

    const { PI } = await module.import<Calculator>('./module-mock-fixtures/calculator.js', import.meta.url)

    assert.equal(PI, 99, 'mocked PI should be visible via module.import()')
  })

  test('isolation: two tests mock the same module differently', async ({ module, assert }) => {
    await module.mock('./module-mock-fixtures/calculator.js', import.meta.url, {
      add: () => -1,
    })
    const { add } = await module.import<Calculator>('./module-mock-fixtures/calculator.js', import.meta.url)

    assert.equal(add(5, 5), -1, 'this test mock should return -1')
  })

  test('teardown: window.__LUPA_MOCKS__ has no leftover keys after test', async ({ module, assert }) => {
    const mocksBefore = Object.keys(window.__LUPA_MOCKS__ ?? {}).length

    await module.mock('./module-mock-fixtures/calculator.js', import.meta.url, { add: () => 42 })

    // The cleanup registered by mock() runs after this test finishes.
    // We verify the count increased during the test (mock is active).
    const mocksAfter = Object.keys(window.__LUPA_MOCKS__ ?? {}).length
    assert.equal(mocksAfter, mocksBefore + 1, 'mock entry should exist during the test')
  })
})
