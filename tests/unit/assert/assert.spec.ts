import { test } from 'node:test'
import assertNode from 'node:assert'
import { Assert } from '../../../src/assert/assert.js'

test('Assert', async (t) => {
  await t.test('tracks assertion counts', () => {
    const assert = new Assert()

    assert.isTrue(true)
    assert.isFalse(false)
    assert.equal(1, 1)

    assertNode.strictEqual(assert.assertions.total, 3)
  })

  await t.test('validate throws if planned assertions mismatch', () => {
    const assert = new Assert()

    assert.plan(2)
    assert.isTrue(true)

    assertNode.throws(() => {
      assert.assertions.validate()
    }, /Planned for 2 assertions, but ran 1/)
  })

  await t.test('validate does not throw if planned assertions match', () => {
    const assert = new Assert()

    assert.plan(1)
    assert.isTrue(true)

    assertNode.doesNotThrow(() => {
      assert.assertions.validate()
    })
  })

  await t.test('validate formatting pluralizes properly', () => {
    const assert = new Assert()

    assert.plan(1)

    assertNode.throws(() => {
      assert.assertions.validate()
    }, /Planned for 1 assertion, but ran 0/)
  })

  await t.test('rejects succeeds if promise rejects', async () => {
    const assert = new Assert()
    await assert.rejects(async () => {
      throw new Error('failed')
    })

    assertNode.strictEqual(assert.assertions.total, 1)
  })

  await t.test('rejects fails if promise resolves', async () => {
    const assert = new Assert()

    await assertNode.rejects(async () => {
      await assert.rejects(async () => {
        return 'success'
      })
    }, /expected \[AsyncFunction\] to throw an error/)
  })

  await t.test('doesNotReject succeeds if promise resolves', async () => {
    const assert = new Assert()
    await assert.doesNotReject(async () => {
      return 'success'
    })

    assertNode.strictEqual(assert.assertions.total, 1)
  })

  await t.test('doesNotReject fails if promise rejects', async () => {
    const assert = new Assert()

    await assertNode.rejects(async () => {
      await assert.doesNotReject(async () => {
        throw new Error('failed')
      })
    }, /expected \[AsyncFunction\] to not throw an error/)
  })

  await t.test('rejects fails if fn is not a function', async () => {
    const assert = new Assert()
    await assertNode.rejects(async () => {
      await assert.rejects(null as any)
    }, /expected null to be a function/)
  })

  await t.test('rejects fails if error constructor does not match', async () => {
    const assert = new Assert()
    await assertNode.rejects(async () => {
      await assert.rejects(async () => {
        throw new TypeError('failed')
      }, SyntaxError)
    }, /expected \[AsyncFunction\] to throw \[Function SyntaxError\] but TypeError: failed was thrown/)
  })

  await t.test('rejects succeeds if error constructor matches', async () => {
    const assert = new Assert()
    await assert.rejects(async () => {
      throw new TypeError('failed')
    }, TypeError)
    assertNode.strictEqual(assert.assertions.total, 1)
  })

  await t.test('rejects fails if error message does not match regex', async () => {
    const assert = new Assert()
    await assertNode.rejects(async () => {
      await assert.rejects(async () => {
        throw new Error('failed')
      }, /success/)
    }, /expected \[AsyncFunction\] to throw error matching \/success\/ but got 'failed'/)
  })

  await t.test('rejects fails if error message does not match string', async () => {
    const assert = new Assert()
    await assertNode.rejects(async () => {
      await assert.rejects(async () => {
        throw new Error('failed')
      }, 'success')
    }, /expected \[AsyncFunction\] to throw error including 'success' but got 'failed'/)
  })

  await t.test('rejects succeeds if error message string matches exactly', async () => {
    const assert = new Assert()
    await assert.rejects(async () => {
      throw new Error('failed')
    }, 'failed')
    assertNode.strictEqual(assert.assertions.total, 1)
  })

  await t.test('doesNotReject fails if fn is not a function', async () => {
    const assert = new Assert()
    await assertNode.rejects(async () => {
      await assert.doesNotReject(null as any)
    }, /expected null to be a function/)
  })

  await t.test('doesNotReject fails if specific error constructor matches', async () => {
    const assert = new Assert()
    await assertNode.rejects(async () => {
      await assert.doesNotReject(async () => {
        throw new TypeError('failed')
      }, TypeError)
    }, /expected \[AsyncFunction\] to not throw \[Function TypeError\] but TypeError: failed was thrown/)
  })

  await t.test('doesNotReject fails if error matches regex', async () => {
    const assert = new Assert()
    await assertNode.rejects(async () => {
      await assert.doesNotReject(async () => {
        throw new Error('failed')
      }, /fail/)
    }, /expected \[AsyncFunction\] to throw error not matching \/fail\//)
  })

  await t.test('doesNotReject fails if error matches string', async () => {
    const assert = new Assert()
    await assertNode.rejects(async () => {
      await assert.doesNotReject(
        async () => {
          throw new TypeError('failed')
        },
        TypeError,
        'failed'
      )
    }, /expected \[AsyncFunction\] to not throw \[Function TypeError\] but TypeError: failed was thrown/)
  })

  await t.test('evaluate delegates correctly and increments count', () => {
    const assert = new Assert()

    assertNode.doesNotThrow(() => {
      assert.evaluate(true, 'should be true', {
        actual: true,
        expected: true,
        operator: 'strictEqual',
      })
    })

    assertNode.strictEqual(assert.assertions.total, 1)

    assertNode.throws(() => {
      assert.evaluate(false, 'should be true', {
        actual: false,
        expected: true,
        operator: 'strictEqual',
      })
    }, /should be true/)
  })

  await t.test('assert succeeds if expression is truthy', () => {
    const assert = new Assert()

    assertNode.doesNotThrow(() => {
      assert.assert(true)
    })
    assertNode.strictEqual(assert.assertions.total, 1)

    assertNode.throws(() => {
      assert.assert(false, 'this should fail')
    }, /this should fail/)
    assertNode.strictEqual(assert.assertions.total, 2)
  })

  await t.test('fail throws unconditionally with single string', () => {
    const assert = new Assert()

    assertNode.throws(() => {
      assert.fail('custom failure')
    }, /custom failure/)

    assertNode.strictEqual(assert.assertions.total, 1)
  })

  await t.test('fail throws unconditionally with multiple args', () => {
    const assert = new Assert()

    assertNode.throws(() => {
      assert.fail(1, 2, 'expected 1 to equal 2', '>')
    }, /expected 1 to equal 2/)

    assertNode.strictEqual(assert.assertions.total, 1)
  })

  await t.test('wrapped chai methods delegate correctly', async (t) => {
    const methods = [
      { name: 'lengthOf', pass: [[1, 2], 2], fail: [[1, 2], 3] },
      { name: 'isOk', pass: [true], fail: [false] },
      { name: 'isNotOk', pass: [false], fail: [true] },
      { name: 'equal', pass: [1, '1'], fail: [1, 2] },
      { name: 'notEqual', pass: [1, 2], fail: [1, '1'] },
      { name: 'strictEqual', pass: [1, 1], fail: [1, '1'] },
      { name: 'notStrictEqual', pass: [1, '1'], fail: [1, 1] },
      { name: 'deepEqual', pass: [{ a: 1 }, { a: 1 }], fail: [{ a: 1 }, { a: 2 }] },
      { name: 'notDeepEqual', pass: [{ a: 1 }, { a: 2 }], fail: [{ a: 1 }, { a: 1 }] },
      { name: 'isAbove', pass: [2, 1], fail: [1, 2] },
      { name: 'isAtLeast', pass: [2, 2], fail: [1, 2] },
      { name: 'isBelow', pass: [1, 2], fail: [2, 1] },
      { name: 'isAtMost', pass: [2, 2], fail: [3, 2] },
      { name: 'isTrue', pass: [true], fail: [false] },
      { name: 'isNotTrue', pass: [false], fail: [true] },
      { name: 'isFalse', pass: [false], fail: [true] },
      { name: 'isNotFalse', pass: [true], fail: [false] },
      { name: 'isNull', pass: [null], fail: [undefined] },
      { name: 'isNotNull', pass: [undefined], fail: [null] },
      { name: 'isNaN', pass: [NaN], fail: [1] },
      { name: 'isNotNaN', pass: [1], fail: [NaN] },
      { name: 'exists', pass: [1], fail: [null] },
      { name: 'notExists', pass: [null], fail: [1] },
      { name: 'isUndefined', pass: [undefined], fail: [null] },
      { name: 'isDefined', pass: [null], fail: [undefined] },
      { name: 'isFunction', pass: [() => {}], fail: [{}] },
      { name: 'isNotFunction', pass: [{}], fail: [() => {}] },
      { name: 'isObject', pass: [{}], fail: [1] },
      { name: 'isNotObject', pass: [1], fail: [{}] },
      { name: 'isArray', pass: [[]], fail: [{}] },
      { name: 'isNotArray', pass: [{}], fail: [[]] },
      { name: 'isString', pass: [''], fail: [1] },
      { name: 'isNotString', pass: [1], fail: [''] },
      { name: 'isNumber', pass: [1], fail: [''] },
      { name: 'isNotNumber', pass: [''], fail: [1] },
      { name: 'isFinite', pass: [1], fail: [Infinity] },
      { name: 'isBoolean', pass: [true], fail: [1] },
      { name: 'isNotBoolean', pass: [1], fail: [true] },
      { name: 'typeOf', pass: [1, 'number'], fail: [1, 'string'] },
      { name: 'notTypeOf', pass: [1, 'string'], fail: [1, 'number'] },
      { name: 'ok', pass: [true], fail: [false] },
      { name: 'notOk', pass: [false], fail: [true] },
      { name: 'instanceOf', pass: [new Date(), Date], fail: [1, Date] },
      { name: 'notInstanceOf', pass: [1, Date], fail: [new Date(), Date] },
      { name: 'include', pass: [[1, 2], 1], fail: [[1, 2], 3] },
      { name: 'notInclude', pass: [[1, 2], 3], fail: [[1, 2], 1] },
      { name: 'deepInclude', pass: [[{ a: 1 }], { a: 1 }], fail: [[{ a: 1 }], { a: 2 }] },
      { name: 'notDeepInclude', pass: [[{ a: 1 }], { a: 2 }], fail: [[{ a: 1 }], { a: 1 }] },
      { name: 'match', pass: ['foo', /foo/], fail: ['foo', /bar/] },
      { name: 'notMatch', pass: ['foo', /bar/], fail: ['foo', /foo/] },
      { name: 'property', pass: [{ a: 1 }, 'a'], fail: [{ a: 1 }, 'b'] },
      { name: 'notProperty', pass: [{ a: 1 }, 'b'], fail: [{ a: 1 }, 'a'] },
      { name: 'propertyVal', pass: [{ a: 1 }, 'a', 1], fail: [{ a: 1 }, 'a', 2] },
      { name: 'notPropertyVal', pass: [{ a: 1 }, 'a', 2], fail: [{ a: 1 }, 'a', 1] },
      { name: 'deepPropertyVal', pass: [{ a: { b: 1 } }, 'a', { b: 1 }], fail: [{ a: { b: 1 } }, 'a', { b: 2 }] },
      { name: 'notDeepPropertyVal', pass: [{ a: { b: 1 } }, 'a', { b: 2 }], fail: [{ a: { b: 1 } }, 'a', { b: 1 }] },
      { name: 'properties', pass: [{ a: 1, b: 2 }, ['a', 'b']], fail: [{ a: 1 }, ['a', 'b']] },
      { name: 'anyProperties', pass: [{ a: 1, c: 2 }, ['a', 'b']], fail: [{ c: 1 }, ['a', 'b']] },
      { name: 'onlyProperties', pass: [{ a: 1, b: 2 }, ['a', 'b']], fail: [{ a: 1, b: 2, c: 3 }, ['a', 'b']] },
      { name: 'notAnyProperties', pass: [{ c: 1 }, ['a', 'b']], fail: [{ a: 1 }, ['a', 'b']] },
      { name: 'notAllProperties', pass: [{ a: 1 }, ['a', 'b']], fail: [{ a: 1, b: 2 }, ['a', 'b']] },
      {
        name: 'throws',
        pass: [
          () => {
            throw new Error()
          },
        ],
        fail: [() => {}],
      },
      {
        name: 'doesNotThrow',
        pass: [() => {}],
        fail: [
          () => {
            throw new Error()
          },
        ],
      },
      { name: 'closeTo', pass: [1.5, 1, 0.5], fail: [2.0, 1, 0.5] },
      { name: 'approximately', pass: [1.5, 1, 0.5], fail: [2.0, 1, 0.5] },
      {
        name: 'sameMembers',
        pass: [
          [1, 2],
          [2, 1],
        ],
        fail: [
          [1, 2],
          [1, 3],
        ],
      },
      {
        name: 'notSameMembers',
        pass: [
          [1, 2],
          [1, 3],
        ],
        fail: [
          [1, 2],
          [2, 1],
        ],
      },
      { name: 'sameDeepMembers', pass: [[{ a: 1 }], [{ a: 1 }]], fail: [[{ a: 1 }], [{ a: 2 }]] },
      { name: 'notSameDeepMembers', pass: [[{ a: 1 }], [{ a: 2 }]], fail: [[{ a: 1 }], [{ a: 1 }]] },
      {
        name: 'sameOrderedMembers',
        pass: [
          [1, 2],
          [1, 2],
        ],
        fail: [
          [1, 2],
          [2, 1],
        ],
      },
      {
        name: 'notSameOrderedMembers',
        pass: [
          [1, 2],
          [2, 1],
        ],
        fail: [
          [1, 2],
          [1, 2],
        ],
      },
      {
        name: 'sameDeepOrderedMembers',
        pass: [
          [{ a: 1 }, { b: 2 }],
          [{ a: 1 }, { b: 2 }],
        ],
        fail: [
          [{ a: 1 }, { b: 2 }],
          [{ b: 2 }, { a: 1 }],
        ],
      },
      {
        name: 'notSameDeepOrderedMembers',
        pass: [
          [{ a: 1 }, { b: 2 }],
          [{ b: 2 }, { a: 1 }],
        ],
        fail: [
          [{ a: 1 }, { b: 2 }],
          [{ a: 1 }, { b: 2 }],
        ],
      },
      {
        name: 'includeMembers',
        pass: [
          [1, 2, 3],
          [1, 2],
        ],
        fail: [
          [1, 2],
          [1, 3],
        ],
      },
      {
        name: 'notIncludeMembers',
        pass: [
          [1, 2],
          [1, 3],
        ],
        fail: [
          [1, 2, 3],
          [1, 2],
        ],
      },
      { name: 'includeDeepMembers', pass: [[{ a: 1 }, { b: 2 }], [{ a: 1 }]], fail: [[{ a: 1 }], [{ b: 2 }]] },
      { name: 'notIncludeDeepMembers', pass: [[{ a: 1 }], [{ b: 2 }]], fail: [[{ a: 1 }, { b: 2 }], [{ a: 1 }]] },
      {
        name: 'includeOrderedMembers',
        pass: [
          [1, 2, 3],
          [1, 2],
        ],
        fail: [
          [1, 2, 3],
          [2, 1],
        ],
      },
      {
        name: 'notIncludeOrderedMembers',
        pass: [
          [1, 2, 3],
          [2, 1],
        ],
        fail: [
          [1, 2, 3],
          [1, 2],
        ],
      },
      {
        name: 'includeDeepOrderedMembers',
        pass: [
          [{ a: 1 }, { b: 2 }, { c: 3 }],
          [{ a: 1 }, { b: 2 }],
        ],
        fail: [
          [{ a: 1 }, { b: 2 }],
          [{ b: 2 }, { a: 1 }],
        ],
      },
      {
        name: 'notIncludeDeepOrderedMembers',
        pass: [
          [{ a: 1 }, { b: 2 }],
          [{ b: 2 }, { a: 1 }],
        ],
        fail: [
          [{ a: 1 }, { b: 2 }, { c: 3 }],
          [{ a: 1 }, { b: 2 }],
        ],
      },
      { name: 'isSealed', pass: [Object.seal({})], fail: [{}] },
      { name: 'sealed', pass: [Object.seal({})], fail: [{}] },
      { name: 'isNotSealed', pass: [{}], fail: [Object.seal({})] },
      { name: 'notSealed', pass: [{}], fail: [Object.seal({})] },
      { name: 'isFrozen', pass: [Object.freeze({})], fail: [{}] },
      { name: 'frozen', pass: [Object.freeze({})], fail: [{}] },
      { name: 'isNotFrozen', pass: [{}], fail: [Object.freeze({})] },
      { name: 'notFrozen', pass: [{}], fail: [Object.freeze({})] },
      { name: 'isEmpty', pass: [[]], fail: [[1]] },
      { name: 'empty', pass: [[]], fail: [[1]] },
      { name: 'isNotEmpty', pass: [[1]], fail: [[]] },
      { name: 'notEmpty', pass: [[1]], fail: [[]] },
      { name: 'containSubset', pass: [{ a: 1, b: 2 }, { a: 1 }], fail: [{ a: 1 }, { b: 2 }] },
      { name: 'doesNotContainSubset', pass: [{ a: 1 }, { b: 2 }], fail: [{ a: 1, b: 2 }, { a: 1 }] },
      { name: 'containsSubset', pass: [{ a: 1, b: 2 }, { a: 1 }], fail: [{ a: 1 }, { b: 2 }] },
      { name: 'notContainsSubset', pass: [{ a: 1 }, { b: 2 }], fail: [{ a: 1, b: 2 }, { a: 1 }] },
      { name: 'oneOf', pass: [1, [1, 2]], fail: [3, [1, 2]] },
    ]

    for (const testCase of methods) {
      await t.test(testCase.name, () => {
        const assert = new Assert()

        // Test pass
        assertNode.doesNotThrow(() => {
          ;(assert as any)[testCase.name](...testCase.pass)
        })
        assertNode.strictEqual(assert.assertions.total, 1)

        // Test fail
        assertNode.throws(() => {
          ;(assert as any)[testCase.name](...testCase.fail)
        })
        assertNode.strictEqual(assert.assertions.total, 2)
      })
    }
  })

  await t.test('rejectsNetworkError succeeds for mock browser environments', async () => {
    const assert = new Assert()

    await assert.rejectsNetworkError(async () => {
      throw new TypeError('Failed to fetch')
    })

    const assertFirefox = new Assert()
    const mockWindow = {
      __lupa__: {
        browserName: 'firefox',
        suites: [],
        config: {},
      },
    }
    globalThis.window = mockWindow as unknown as Window & typeof globalThis

    await assertFirefox.rejectsNetworkError(async () => {
      throw new TypeError('NetworkError when attempting to fetch resource.')
    })

    const assertWebKit = new Assert()
    mockWindow.__lupa__.browserName = 'webkit'
    await assertWebKit.rejectsNetworkError(async () => {
      throw new TypeError('Load failed')
    })

    // Clean up
    const globalObj = globalThis as unknown as { window?: unknown }
    delete globalObj.window
  })

  await t.test('rejects supports browser map patterns', async () => {
    const assert = new Assert()

    const mockWindow = {
      __lupa__: {
        browserName: 'firefox',
        suites: [],
        config: {},
      },
    }
    globalThis.window = mockWindow as unknown as Window & typeof globalThis

    // firefox rejects correctly
    await assert.rejects(
      async () => {
        throw new Error('Firefox connection failed')
      },
      {
        chromium: 'Chrome connection failed',
        firefox: /Firefox/,
        webkit: 'WebKit connection failed',
      }
    )

    // firefox rejects incorrectly
    await assertNode.rejects(async () => {
      await assert.rejects(
        async () => {
          throw new Error('Chrome connection failed')
        },
        {
          chromium: 'Chrome connection failed',
          firefox: 'WebKit connection failed',
          webkit: 'WebKit connection failed',
        }
      )
    }, /expected \[AsyncFunction\] to throw error including 'WebKit connection failed'/)

    // Clean up
    const globalObj = globalThis as unknown as { window?: unknown }
    delete globalObj.window
  })

  await t.test('rejects supports array of patterns', async () => {
    const assert = new Assert()

    await assert.rejects(async () => {
      throw new Error('failed validation')
    }, ['success', /validation/, 'another'])

    await assertNode.rejects(async () => {
      await assert.rejects(async () => {
        throw new Error('failed completely')
      }, ['success', /validation/, 'another'])
    }, /expected \[AsyncFunction\] to throw error matching 'one of/)
  })

  await t.test('doesNotReject supports browser map patterns', async () => {
    const assert = new Assert()

    const mockWindow = {
      __lupa__: {
        browserName: 'webkit',
        suites: [],
        config: {},
      },
    }
    globalThis.window = mockWindow as unknown as Window & typeof globalThis

    // webkit error does not match chromium pattern, so doesNotReject passes
    await assert.doesNotReject(
      async () => {
        throw new Error('WebKit failed')
      },
      {
        chromium: 'WebKit failed',
        firefox: 'Firefox failed',
      }
    )

    // webkit error matches webkit pattern, so doesNotReject fails
    await assertNode.rejects(async () => {
      await assert.doesNotReject(
        async () => {
          throw new Error('WebKit failed')
        },
        {
          webkit: 'WebKit failed',
        }
      )
    }, /expected \[AsyncFunction\] to throw error not including 'WebKit failed'/)

    // Clean up
    const globalObj = globalThis as unknown as { window?: unknown }
    delete globalObj.window
  })

  await t.test('doesNotReject supports array of patterns', async () => {
    const assert = new Assert()

    await assert.doesNotReject(async () => {
      throw new Error('failed completely')
    }, ['success', /validation/])

    await assertNode.rejects(async () => {
      await assert.doesNotReject(async () => {
        throw new Error('failed validation')
      }, ['success', /validation/])
    }, /expected \[AsyncFunction\] to throw error not matching 'one of/)
  })
})
