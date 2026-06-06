/*
 * @japa/assert
 *
 * (c) Japa.dev
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { assert, Assertion } from 'chai'
import Macroable from '@poppinss/macroable'
import { AssertionError } from 'assertion-error'

import type { AnyErrorConstructor, AssertContract, ChaiAssert } from './types.js'
import { AssertDom } from './dom.js'
import { assertIsAccessible } from './accessibility.js'
import type axe from 'axe-core'

/**
 * A generic class constructor
 */
export type Constructor<T> = new (...args: any[]) => T

/**
 * Defines a pattern to match against raised exception messages.
 *
 * It supports:
 * - A simple `string` (checking if the message includes the string)
 * - A `RegExp` (checking if the message matches the expression)
 * - An object mapping browser names (`chromium`, `firefox`, `webkit`) to their respective expected patterns
 * - An array containing any combination of strings, RegExps, or browser mapping objects
 */
export type ExpectedErrorPattern =
  | string
  | RegExp
  | Record<string, string | RegExp | (string | RegExp)[]>
  | (string | RegExp | Record<string, string | RegExp>)[]

/**
 * The Assert class is derived from chai.assert to allow support
 * for additional assertion methods and assertion planning.
 *
 * Also some of the methods from chai.assert are not available
 * and some additional methods have been added.
 *
 * @example
 * const assert = new Assert()
 * assert.deepEqual({ id: 1 }, { id: 1 })
 */
export class Assert extends Macroable implements AssertContract {
  #dom?: AssertDom

  /**
   * DOM-specific assertions
   */
  get dom(): AssertDom {
    if (!this.#dom) {
      this.#dom = new AssertDom(this)
    }
    return this.#dom
  }

  /**
   * Tracking assertions
   */
  assertions: {
    planned?: number
    total: number
    mismatchError: null | Error
    validate(): void
  } = {
    total: 0,
    mismatchError: null,
    validate() {
      if (this.planned === undefined || !this.mismatchError) {
        return
      }

      if (this.planned !== this.total) {
        const suffix = this.planned === 1 ? '' : 's'
        const message = `Planned for ${this.planned} assertion${suffix}, but ran ${this.total}`
        this.mismatchError.message = message
        throw this.mismatchError
      }
    },
  }

  Assertion = Assertion
  AssertionError = AssertionError

  /**
   * Increments the assertions count by 1
   */
  incrementAssertionsCount() {
    this.assertions.total += 1
  }

  /**
   * Plan assertions to expect by the end of this test
   *
   * This method is used to declare the number of assertions you expect to run
   * in a test. If the number of assertions that actually run does not match
   * the planned number, the test will fail.
   *
   * @param assertionsToExpect - The number of assertions to expect
   */
  plan(assertionsToExpect: number): this {
    const error = new Error()
    if (Error.captureStackTrace) {
      Error.captureStackTrace(error)
    }

    this.assertions.planned = assertionsToExpect
    this.assertions.mismatchError = error
    return this
  }

  /**
   * Evaluate an expression and raise {@link AssertionError} if expression
   * is not truthy
   *
   * This method is used internally by other assertion methods to evaluate expressions
   * and raise {@link AssertionError} if the expression is not truthy.
   *
   * @param expression - The expression to evaluate
   * @param message - The error message to use if the expression is not truthy
   * @param stackProps - Additional properties to use for the error stack
   */
  evaluate(
    expression: any,
    message: string,
    stackProps: {
      actual: any
      expected: any
      operator: string
      showDiff?: boolean
      prefix?: string
      thisObject?: any
    }
  ) {
    this.incrementAssertionsCount()
    this.Assertion.prototype.assert.call(
      {
        __flags: {
          operator: stackProps.operator,
          message: stackProps.prefix,
          object: stackProps.thisObject,
        },
      },
      expression,
      message,
      '',
      stackProps.expected,
      stackProps.actual,
      stackProps.showDiff === undefined ? true : stackProps.showDiff
    )
  }

  /**
   * Assert an expression to be truthy.
   * Optionally define the error message
   *
   * @example:
   * assert(isTrue(foo))
   * assert(foo === 'bar')
   * assert(age > 18, 'Not allowed to enter the club')
   *
   * @param expression - The expression to evaluate
   * @param message - The error message to use if the expression is not truthy
   */
  assert(expression: any, message?: string): void {
    this.incrementAssertionsCount()
    return assert(expression, message)
  }

  /**
   * Throws a failure.
   *
   * @remarks
   * The actual and expected values are not compared. They are available as
   * properties on the {@link AssertionError}.
   *
   * @example
   * assert.fail() // fail
   * assert.fail('Error message for the failure')
   *
   * @param message - The error message to use if the expression is not truthy
   * @returns This method always throws an error
   */
  fail(message?: string): never

  /**
   * Throw a failure.
   *
   * @param actual - The actual value to use for the error message
   * @param expected - The expected value to use for the error message
   * @param message - The error message to use if the expression is not truthy
   * @param operator - The operator to use for the error message
   * @returns This method always throws an error
   */
  fail<T>(actual: T, expected: T, message?: string, operator?: Chai.Operator): never
  /**
   * Throw a failure. Optionally accepts "actual" and "expected" values for
   * the default error message.
   *
   * @param actual - The actual value to use for the error message
   * @param expected - The expected value to use for the error message
   * @param message - The error message to use if the expression is not truthy
   * @param operator - The operator to use for the error message
   * @returns This method always throws an error
   */
  fail<T>(actual?: T | string, expected?: T, message?: string, operator?: Chai.Operator): never {
    this.incrementAssertionsCount()
    if (arguments.length === 1 && typeof actual === 'string') {
      assert.fail(actual)
    }

    assert.fail(actual, expected, message, operator)
  }

  /**
   * Assert the value is truthy
   *
   * @example
   * assert.isOk({ hello: 'world' }) // passes
   * assert.isOk(null) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not truthy
   */
  isOk(value: unknown, message?: string): ReturnType<ChaiAssert['isOk']> {
    this.incrementAssertionsCount()
    return assert.isOk(value, message)
  }

  /**
   * Assert the value is truthy
   *
   * @remarks
   * Alias for {@link isOk}
   *
   * @example
   * assert.ok({ hello: 'world' }) // passes
   * assert.ok(null) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not truthy
   */
  ok(value: unknown, message?: string): ReturnType<ChaiAssert['ok']> {
    this.incrementAssertionsCount()
    return assert.ok(value, message)
  }

  /**
   * Assert the value is falsy
   *
   * @example
   * assert.isNotOk({ hello: 'world' }) // fails
   * assert.isNotOk(null) // passes
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not falsy
   */
  isNotOk<T>(value: T, message?: string): ReturnType<ChaiAssert['isNotOk']> {
    this.incrementAssertionsCount()
    return assert.isNotOk(value, message)
  }

  /**
   * Assert the value is falsy
   *
   * @remarks
   * Alias for {@link isNotOk}
   *
   * @example
   * assert.notOk({ hello: 'world' }) // fails
   * assert.notOk(null) // passes
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not falsy
   */
  notOk<T>(value: T, message?: string): ReturnType<ChaiAssert['notOk']> {
    this.incrementAssertionsCount()
    return assert.notOk(value, message)
  }

  /**
   * Assert two values are equal but not strictly. The comparison
   * is same as "foo == bar".
   *
   * @see {@link strictEqual} for strict equality
   * @see {@link deepEqual} for comparing objects and arrays
   *
   * @example
   * assert.equal(3, 3) // passes
   * assert.equal(3, '3') // passes
   * assert.equal(Symbol.for('foo'), Symbol.for('foo')) // passes
   *
   * @param actual - The actual value to compare
   * @param expected - The expected value to compare
   * @param message - The error message to use if the values are not equal
   */
  equal<T>(actual: T, expected: T, message?: string): ReturnType<ChaiAssert['equal']> {
    this.incrementAssertionsCount()
    return assert.equal(actual, expected, message)
  }

  /**
   * Assert two values are not equal. The comparison
   * is same as "foo != bar".
   *
   * @see {@link notStrictEqual} for strict inequality
   * @see {@link notDeepEqual} for comparing objects and arrays
   *
   * @example
   * assert.notEqual(3, 2) // passes
   * assert.notEqual(3, '2') // passes
   * assert.notEqual(Symbol.for('foo'), Symbol.for('bar')) // passes
   *
   * @param actual - The actual value to compare
   * @param expected - The expected value to compare
   * @param message - The error message to use if the values are not equal
   */
  notEqual<T>(actual: T, expected: T, message?: string): ReturnType<ChaiAssert['notEqual']> {
    this.incrementAssertionsCount()
    return assert.notEqual(actual, expected, message)
  }

  /**
   * Assert two values are strictly equal. The comparison
   * is same as "foo === bar".
   *
   * @see {@link equal} for non-strict equality
   * @see {@link deepEqual} for comparing objects and arrays
   *
   * @example
   * assert.equal(3, 3) // passes
   * assert.equal(3, '3') // fails
   * assert.equal(Symbol.for('foo'), Symbol.for('foo')) // passes
   *
   * @param actual - The actual value to compare
   * @param expected - The expected value to compare
   * @param message - The error message to use if the values are not strictly equal
   */
  strictEqual<T>(actual: T, expected: T, message?: string): ReturnType<ChaiAssert['strictEqual']> {
    this.incrementAssertionsCount()
    return assert.strictEqual(actual, expected, message)
  }

  /**
   * Assert two values are not strictly equal. The comparison
   * is same as "foo !== bar".
   *
   * @see {@link notEqual} for non-strict equality
   * @see {@link notDeepEqual} for comparing objects and arrays
   *
   * @example
   * assert.notStrictEqual(3, 2) // passes
   * assert.notStrictEqual(3, '2') // fails
   * assert.notStrictEqual(Symbol.for('foo'), Symbol.for('bar')) // passes
   *
   * @param actual - The actual value to compare
   * @param expected - The expected value to compare
   * @param message - The error message to use if the values are not strictly equal
   */
  notStrictEqual<T>(actual: T, expected: T, message?: string): ReturnType<ChaiAssert['notStrictEqual']> {
    this.incrementAssertionsCount()
    return assert.notStrictEqual(actual, expected, message)
  }

  /**
   * Assert two values are deeply equal. The order of items in
   * an array should be same for the assertion to pass.
   *
   * @example
   * assert.deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }) // passes
   * assert.deepEqual({ b: 2, a: 1 }, { a: 1, b: 2 }) // passes
   * assert.deepEqual([1, 2], [1, 2]) // passes
   * assert.deepEqual([1, 2], [2, 1]) // fails
   * assert.deepEqual(/a/, /a/) // passes
   * assert.deepEqual(
   *   new Date('2020 01 22'),
   *   new Date('2020 01 22')
   * ) // passes
   *
   * @param actual - The actual value to compare
   * @param expected - The expected value to compare
   * @param message - The error message to use if the values are not deeply equal
   */
  deepEqual<T>(actual: T, expected: T, message?: string): ReturnType<ChaiAssert['deepEqual']> {
    this.incrementAssertionsCount()
    return assert.deepEqual(actual, expected, message)
  }

  /**
   * Assert two values are not deeply equal.
   *
   * @example
   * assert.notDeepEqual({ a: 1, b: 2 }, { a: 1, b: '2' }) // passes
   * assert.notDeepEqual([1, 2], [2, 1]) // passes
   * assert.notDeepEqual(
   *   new Date('2020 01 22'),
   *   new Date('2020 01 23')
   * ) // passes
   *
   * @param actual - The actual value to compare
   * @param expected - The expected value to compare
   * @param message - The error message to use if the values are not deeply equal
   */
  notDeepEqual<T>(actual: T, expected: T, message?: string): ReturnType<ChaiAssert['notDeepEqual']> {
    this.incrementAssertionsCount()
    return assert.notDeepEqual(actual, expected, message)
  }

  /**
   * Assert if the actual Date is above the expected Date.
   *
   * @example
   * assert.isAbove(new Date('2020 12 20'), new Date('2020 12 18')) // passes
   *
   * @param valueToCheck - The value to assert
   * @param valueToBeAbove - The value to be above
   * @param message - The error message to use if the value is not above the expected value
   */
  isAbove(valueToCheck: Date, valueToBeAbove: Date, message?: string): void

  /**
   * Assert if the actual number is above the expected number.
   *
   * @example
   * assert.isAbove(5, 2) // passes
   *
   * @param valueToCheck - The value to assert
   * @param valueToBeAbove - The value to be above
   * @param message - The error message to use if the value is not above the expected value
   */
  isAbove(valueToCheck: number, valueToBeAbove: number, message?: string): void

  /**
   * Assert if the actual value is above the expected value. Supports
   * numbers and dates.
   *
   * @example
   * assert.isAbove(5, 2) // passes
   * assert.isAbove(new Date('2020 12 20'), new Date('2020 12 18')) // passes
   *
   * @param valueToCheck - The value to assert
   * @param valueToBeAbove - The value to be above
   * @param message - The error message to use if the value is not above the expected value
   */
  isAbove<T extends number | Date>(
    valueToCheck: T,
    valueToBeAbove: T,
    message?: string
  ): ReturnType<ChaiAssert['isAbove']> {
    this.incrementAssertionsCount()
    return assert.isAbove(valueToCheck as number, valueToBeAbove as number, message)
  }

  /**
   * Assert if the actual value is above or same as the expected value.
   *
   * @example
   * assert.isAtLeast(new Date('2020 12 20'), new Date('2020 12 20')) // passes
   *
   * @param valueToCheck - The value to assert
   * @param valueToBeAtLeast - The value to be at least
   * @param message - The error message to use if the value is not at least the expected value
   */
  isAtLeast(valueToCheck: Date, valueToBeAtLeast: Date, message?: string): void

  /**
   * Assert if the actual value is above or same as the expected value.
   *
   * @example
   * assert.isAtLeast(2, 2) // passes
   *
   * @param valueToCheck - The value to assert
   * @param valueToBeAtLeast - The value to be at least
   * @param message - The error message to use if the value is not at least the expected value
   */
  isAtLeast(valueToCheck: number, valueToBeAtLeast: number, message?: string): void

  /**
   * Assert if the actual value is above or same as the expected value.
   * Supports numbers and dates.
   *
   * @example
   * assert.isAtLeast(new Date('2020 12 20'), new Date('2020 12 20')) // passes
   * assert.isAtLeast(2, 2) // passes
   *
   * @param valueToCheck - The value to assert
   * @param valueToBeAtLeast - The value to be at least
   * @param message - The error message to use if the value is not at least the expected value
   */
  isAtLeast(
    valueToCheck: number | Date,
    valueToBeAtLeast: number | Date,
    message?: string
  ): ReturnType<ChaiAssert['isAtLeast']> {
    this.incrementAssertionsCount()
    return assert.isAtLeast(valueToCheck as number, valueToBeAtLeast as number, message)
  }

  /**
   * Assert if the actual value is below the expected value.
   *
   * @example
   * assert.isBelow(new Date('2020 12 20'), new Date('2020 12 24')) // passes
   *
   * @param valueToCheck - The value to assert
   * @param valueToBeBelow - The value to be below
   * @param message - The error message to use if the value is not below the expected value
   */
  isBelow(valueToCheck: Date, valueToBeBelow: Date, message?: string): void

  /**
   * Assert if the actual value is below the expected value.
   *
   * @example
   * assert.isBelow(2, 5) // passes
   *
   * @param valueToCheck - The value to assert
   * @param valueToBeBelow - The value to be below
   * @param message - The error message to use if the value is not below the expected value
   */
  isBelow(valueToCheck: number, valueToBeBelow: number, message?: string): void

  /**
   * Assert if the actual value is below the expected value. Supports
   * numbers and dates.
   *
   * @example
   * assert.isBelow(2, 5) // passes
   * assert.isBelow(new Date('2020 12 20'), new Date('2020 12 24')) // passes
   *
   * @param valueToCheck - The value to assert
   * @param valueToBeBelow - The value to be below
   * @param message - The error message to use if the value is not below the expected value
   */
  isBelow(
    valueToCheck: number | Date,
    valueToBeBelow: number | Date,
    message?: string
  ): ReturnType<ChaiAssert['isBelow']> {
    this.incrementAssertionsCount()
    return assert.isBelow(valueToCheck as number, valueToBeBelow as number, message)
  }

  /**
   * Assert if the actual value is below or same as the expected value.
   *
   * @example
   * assert.isAtMost(new Date('2020 12 20'), new Date('2020 12 20')) // passes
   *
   * @param valueToCheck - The value to assert
   * @param valueToBeAtMost - The value to be at most
   * @param message - The error message to use if the value is not at most the expected value
   */
  isAtMost(valueToCheck: Date, valueToBeAtMost: Date, message?: string): void
  /**
   * Assert if the actual value is below or same as the expected value.
   *
   * @example
   * assert.isAtMost(2, 2) // passes
   *
   * @param valueToCheck - The value to assert
   * @param valueToBeAtMost - The value to be at most
   * @param message - The error message to use if the value is not at most the expected value
   */
  isAtMost(valueToCheck: number, valueToBeAtMost: number, message?: string): void
  /**
   * Assert if the actual value is below or same as the expected value.
   * Supports numbers and dates.
   *
   * @example
   * assert.isAtMost(2, 2) // passes
   * assert.isAtMost(new Date('2020 12 20'), new Date('2020 12 20')) // passes
   *
   * @param valueToCheck - The value to assert
   * @param valueToBeAtMost - The value to be at most
   * @param message - The error message to use if the value is not at most the expected value
   */
  isAtMost(
    valueToCheck: number | Date,
    valueToBeAtMost: number | Date,
    message?: string
  ): ReturnType<ChaiAssert['isAtMost']> {
    this.incrementAssertionsCount()
    return assert.isAtMost(valueToCheck as number, valueToBeAtMost as number, message)
  }

  /**
   * Assert the value is a boolean (true).
   *
   * @example
   * assert.isTrue(true) // passes
   * assert.isTrue(false) // fails
   * assert.isTrue(1) // fails
   * assert.isTrue('foo') // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not true
   */
  isTrue(value: unknown, message?: string): ReturnType<ChaiAssert['isTrue']> {
    this.incrementAssertionsCount()
    return assert.isTrue(value, message)
  }

  /**
   * Assert the value is anything, but not true
   *
   * @example
   * assert.isNotTrue(true) // fails
   * assert.isNotTrue(false) // passes
   * assert.isNotTrue(1) // passes
   * assert.isNotTrue('foo') // passes
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not true
   */
  isNotTrue<T>(value: T, message?: string): ReturnType<ChaiAssert['isNotTrue']> {
    this.incrementAssertionsCount()
    return assert.isNotTrue(value, message)
  }

  /**
   * Assert the value is boolean (false)
   *
   * @example
   * assert.isFalse(false) // passes
   * assert.isFalse(true) // fails
   * assert.isFalse(0) // fails
   * assert.isFalse(null) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not false
   */
  isFalse(value: unknown, message?: string): ReturnType<ChaiAssert['isFalse']> {
    this.incrementAssertionsCount()
    return assert.isFalse(value, message)
  }

  /**
   * Assert the value is anything but not false
   *
   * @example
   * assert.isNotFalse(false) // fails
   * assert.isNotFalse(true) // passes
   * assert.isNotFalse(null) // passes
   * assert.isNotFalse(undefined) // passes
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not false
   */
  isNotFalse<T>(value: T, message?: string): ReturnType<ChaiAssert['isNotFalse']> {
    this.incrementAssertionsCount()
    return assert.isNotFalse(value, message)
  }

  /**
   * Assert the value is null
   *
   * @example
   * assert.isNull(null) // passes
   * assert.isNull(true) // fails
   * assert.isNull(false) // fails
   * assert.isNull('foo') // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not null
   */
  isNull(value: unknown, message?: string): ReturnType<ChaiAssert['isNull']> {
    this.incrementAssertionsCount()
    return assert.isNull(value, message)
  }

  /**
   * Assert the value is anything but not null
   *
   * @example
   * assert.isNotNull(null) // fails
   * assert.isNotNull(true) // passes
   * assert.isNotNull(false) // passes
   * assert.isNotNull('foo') // passes
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not null
   */
  isNotNull<T>(value: T, message?: string): ReturnType<ChaiAssert['isNotNull']> {
    this.incrementAssertionsCount()
    return assert.isNotNull(value, message)
  }

  /**
   * Assert the value is NaN
   *
   * @example
   * assert.isNaN(NaN) // passes
   * assert.isNaN(Number('hello')) // passes
   * assert.isNaN(true) // fails
   * assert.isNaN(false) // fails
   * assert.isNaN(null) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not NaN
   */
  isNaN<T>(value: T, message?: string): ReturnType<ChaiAssert['isNaN']> {
    this.incrementAssertionsCount()
    return assert.isNaN(value, message)
  }

  /**
   * Assert the value is anything, but not NaN
   *
   * @example
   * assert.isNotNaN(NaN) // fails
   * assert.isNotNaN(Number('hello')) // fails
   * assert.isNotNaN(true) // passes
   * assert.isNotNaN(false) // passes
   * assert.isNotNaN(null) // passes
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not NaN
   */
  isNotNaN<T>(value: T, message?: string): ReturnType<ChaiAssert['isNotNaN']> {
    this.incrementAssertionsCount()
    return assert.isNotNaN(value, message)
  }

  /**
   * Asserts the value is not "null" or "undefined"
   *
   * @example
   * assert.exists(false) // passes
   * assert.exists(0) // passes
   * assert.exists('') // passes
   * assert.exists(null) // fails
   * assert.exists(undefined) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not defined
   */
  exists<T>(value: T, message?: string): ReturnType<ChaiAssert['exists']> {
    this.incrementAssertionsCount()
    return assert.exists(value, message)
  }

  /**
   * Asserts the value is "null" or "undefined"
   *
   * @example
   * assert.notExists(null) // passes
   * assert.notExists(undefined) // passes
   * assert.notExists('') // fails
   * assert.notExists(false) // fails
   * assert.notExists(0) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is defined
   */
  notExists(value: unknown, message?: string): ReturnType<ChaiAssert['notExists']> {
    this.incrementAssertionsCount()
    return assert.notExists(value, message)
  }

  /**
   * Asserts the value is explicitly "undefined"
   *
   * @example
   * assert.isUndefined(undefined) // passes
   * assert.isUndefined(false) // fails
   * assert.isUndefined(0) // fails
   * assert.isUndefined('') // fails
   * assert.isUndefined(null) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not undefined
   */
  isUndefined(value: unknown, message?: string): ReturnType<ChaiAssert['isUndefined']> {
    this.incrementAssertionsCount()
    return assert.isUndefined(value, message)
  }

  /**
   * Asserts the value is anything, but not "undefined"
   *
   * @example
   * assert.isDefined(undefined) // fails
   * assert.isDefined(0) // passes
   * assert.isDefined(false) // passes
   * assert.isDefined('') // passes
   * assert.isDefined(null) // passes
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not defined
   */
  isDefined<T>(value: T, message?: string): ReturnType<ChaiAssert['isDefined']> {
    this.incrementAssertionsCount()
    return assert.isDefined(value, message)
  }

  /**
   * Assert the value is a function
   *
   * @example
   * assert.isFunction(function foo () {}) // passes
   * assert.isFunction(() => {}) // passes
   * assert.isFunction(class Foo {}) // passes
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not a function
   */
  isFunction<T>(value: T, message?: string): ReturnType<ChaiAssert['isFunction']> {
    this.incrementAssertionsCount()
    return assert.isFunction(value, message)
  }

  /**
   * Assert the value is not a function
   *
   * @example
   * assert.isNotFunction({}) // passes
   * assert.isNotFunction(null) // passes
   * assert.isNotFunction(() => {}) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is a function
   */
  isNotFunction<T>(value: T, message?: string): ReturnType<ChaiAssert['isNotFunction']> {
    this.incrementAssertionsCount()
    return assert.isNotFunction(value, message)
  }

  /**
   * Assert the value to a valid object literal
   *
   * @example
   * assert.isObject({}) // passes
   * assert.isObject(new SomeClass()) // passes
   * assert.isObject(null) // fails
   * assert.isObject([]) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not an object
   */
  isObject<T>(value: T, message?: string): ReturnType<ChaiAssert['isObject']> {
    this.incrementAssertionsCount()
    return assert.isObject(value, message)
  }

  /**
   * Assert the value to not be an object literal
   *
   * @example
   * assert.isNotObject(null) // passes
   * assert.isNotObject([]) // passes
   * assert.isNotObject({}) // fails
   * assert.isNotObject(new SomeClass()) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is an object
   */
  isNotObject<T>(value: T, message?: string): ReturnType<ChaiAssert['isNotObject']> {
    this.incrementAssertionsCount()
    return assert.isNotObject(value, message)
  }

  /**
   * Assert the value to be a valid array

   * @example
   * assert.isArray([]) // passes
   * assert.isArray({}) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not an array
   */
  isArray<T>(value: T, message?: string): ReturnType<ChaiAssert['isArray']> {
    this.incrementAssertionsCount()
    return assert.isArray(value, message)
  }

  /**
   * Assert the value to not be an array

   * @example
   * assert.isNotArray([]) // fails
   * assert.isNotArray({}) // passes
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is an array
   */
  isNotArray<T>(value: T, message?: string): ReturnType<ChaiAssert['isNotArray']> {
    this.incrementAssertionsCount()
    return assert.isNotArray(value, message)
  }

  /**
   * Assert the value to be a string literal

   * @example
   * assert.isString('') // passes
   * assert.isString(new String(true)) // passes
   * assert.isString(1) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not a string
   */
  isString<T>(value: T, message?: string): ReturnType<ChaiAssert['isString']> {
    this.incrementAssertionsCount()
    return assert.isString(value, message)
  }

  /**
   * Assert the value to not be a string literal
   *
   * @example
   * assert.isNotString(1) // passes
   * assert.isNotString('') // fails
   * assert.isNotString(new String(true)) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is a string
   */
  isNotString<T>(value: T, message?: string): ReturnType<ChaiAssert['isNotString']> {
    this.incrementAssertionsCount()
    return assert.isNotString(value, message)
  }

  /**
   * Assert the value to be a valid number
   *
   * @example
   * assert.isNumber(1) // passes
   * assert.isNumber(new Number('1')) // passes
   * assert.isNumber('1') // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not a number
   */
  isNumber<T>(value: T, message?: string): ReturnType<ChaiAssert['isNumber']> {
    this.incrementAssertionsCount()
    return assert.isNumber(value, message)
  }

  /**
   * Assert the value to not be a valid number
   *
   * @example
   * assert.isNotNumber('1') // passes
   * assert.isNotNumber(1) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is a number
   */
  isNotNumber<T>(value: T, message?: string): ReturnType<ChaiAssert['isNotNumber']> {
    this.incrementAssertionsCount()
    return assert.isNotNumber(value, message)
  }

  /**
   * Assert the value to be a number and no NaN or Infinity
   *
   * @example
   * assert.isFinite(1) // passes
   * assert.isFinite(Infinity) // fails
   * assert.isFinite(NaN) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not a finite number
   */
  isFinite<T>(value: T, message?: string): ReturnType<ChaiAssert['isFinite']> {
    this.incrementAssertionsCount()
    return assert.isFinite(value, message)
  }

  /**
   * Assert the value is a boolean
   *
   * @example
   * assert.isBoolean(true) // passes
   * assert.isBoolean(false) // passes
   * assert.isBoolean(1) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is not a boolean
   */
  isBoolean<T>(value: T, message?: string): ReturnType<ChaiAssert['isBoolean']> {
    this.incrementAssertionsCount()
    return assert.isBoolean(value, message)
  }

  /**
   * Assert the value is anything, but not a boolean
   *
   * @example
   * assert.isNotBoolean(1) // passes
   * assert.isNotBoolean(false) // fails
   * assert.isNotBoolean(true) // fails
   *
   * @param value - The value to assert
   * @param message - The error message to use if the value is a boolean
   */
  isNotBoolean<T>(value: T, message?: string): ReturnType<ChaiAssert['isNotBoolean']> {
    this.incrementAssertionsCount()
    return assert.isNotBoolean(value, message)
  }

  /**
   * Assert the typeof value matches the expected type
   *
   * @example
   * assert.typeOf({ foo: 'bar' }, 'object') // passes
   * assert.typeOf(['admin'], 'array') // passes
   * assert.typeOf(new Date(), 'date') // passes
   *
   * @param value - The value to assert
   * @param type - The expected type
   * @param message - The error message to use if the value is not of the expected type
   */
  typeOf<T>(value: T, type: string, message?: string): ReturnType<ChaiAssert['typeOf']> {
    this.incrementAssertionsCount()
    return assert.typeOf(value, type, message)
  }

  /**
   * Assert the typeof value is not same as the expected type
   *
   * @example
   * assert.notTypeOf({ foo: 'bar' }, 'array') // passes
   * assert.notTypeOf(['admin'], 'string') // passes
   *
   * @param value - The value to assert
   * @param type - The expected type
   * @param message - The error message to use if the value is of the expected type
   */
  notTypeOf<T>(value: T, type: string, message?: string): ReturnType<ChaiAssert['notTypeOf']> {
    this.incrementAssertionsCount()
    return assert.notTypeOf(value, type, message)
  }

  /**
   * Assert value to be an instance of the expected class
   *
   * @example
   * assert.instanceOf(new User(), User) // passes
   * assert.instanceOf(new User(), Function) // fails
   *
   * class User extends BaseUser {}
   * assert.instanceOf(new User(), BaseUser) // passes
   *
   * @param value - The value to assert
   * @param constructor - The expected constructor
   * @param message - The error message to use if the value is not an instance of the expected constructor
   * @template T - Expected type of value.
   */
  instanceOf<T>(value: T, constructor: Constructor<T>, message?: string): void {
    this.incrementAssertionsCount()
    return assert.instanceOf(value, constructor, message)
  }

  /**
   * Assert value to NOT be an instance of the expected
   * class
   *
   * @example
   * assert.notInstanceOf(new User(), Function) // passes
   * assert.notInstanceOf(new User(), User) // fails
   *
   * @param value - The value to assert
   * @param type - The expected constructor
   * @param message - The error message to use if the value is not an instance of the expected constructor
   * @template T - Type of value.
   * @template U - Type that value shouldn't be an instance of.
   */
  notInstanceOf<T, U>(value: T, type: Constructor<U>, message?: string): void {
    this.incrementAssertionsCount()
    return assert.notInstanceOf(value, type, message)
  }

  /**
   * Asserts that haystack includes needle.
   *
   * @param haystack   Container string.
   * @param needle   Potential substring of haystack.
   * @param message   Message to display on error.
   */
  include(haystack: string, needle: string, message?: string): void

  /**
   * Asserts that haystack includes needle.
   *
   * T   Type of values in haystack.
   * @param haystack   Container array, set or map.
   * @param needle   Potential value contained in haystack.
   * @param message   Message to display on error.
   */
  include<T>(haystack: readonly T[] | ReadonlySet<T> | ReadonlyMap<any, T>, needle: T, message?: string): void

  /**
   * Asserts that haystack includes needle.
   *
   * T   Type of values in haystack.
   * @param haystack   WeakSet container.
   * @param needle   Potential value contained in haystack.
   * @param message   Message to display on error.
   */
  include<T extends object>(haystack: WeakSet<T>, needle: T, message?: string): void

  /**
   * Asserts that haystack includes needle.
   *
   * T   Type of haystack.
   * @param haystack   Object.
   * @param needle   Potential subset of the haystack's properties.
   * @param message   Message to display on error.
   */
  include<T>(haystack: T, needle: Partial<T>, message?: string): void
  /**
   * Assert the collection includes an item. Works for strings, arrays
   * and objects.
   *
   * @see {@link deepInclude} for deep comparison
   *
   * @example
   * assert.include(
   *   { id: 1, name: 'virk' },
   *   { name: 'virk' }
   * ) // passes
   *
   * assert.include([1, 2, 3], 2) // passes
   * assert.include('hello world', 'hello') // passes
   */
  include(...args: Parameters<ChaiAssert['include']>): ReturnType<ChaiAssert['include']> {
    this.incrementAssertionsCount()
    return assert.include(...args)
  }

  /**
   * Asserts that haystack does not include needle.
   *
   * @param haystack   Container string.
   * @param needle   Potential substring of haystack.
   * @param message   Message to display on error.
   */
  notInclude(haystack: string, needle: string, message?: string): void

  /**
   * Asserts that haystack does not include needle.
   *
   * @template T - Type of values in haystack.
   * @param haystack - Container array, set or map.
   * @param needle - Potential value contained in haystack.
   * @param message - Message to display on error.
   */
  notInclude<T>(haystack: readonly T[] | ReadonlySet<T> | ReadonlyMap<any, T>, needle: T, message?: string): void

  /**
   * Asserts that haystack does not include needle.
   *
   * @template T - Type of values in haystack.
   * @param haystack - WeakSet container.
   * @param needle - Potential value contained in haystack.
   * @param message - Message to display on error.
   */
  notInclude<T extends object>(haystack: WeakSet<T>, needle: T, message?: string): void

  /**
   * Asserts that haystack does not include needle.
   *
   * @template T - Type of haystack.
   * @param haystack - Object.
   * @param needle - Potential subset of the haystack's properties.
   * @param message - Message to display on error.
   */
  notInclude<T>(haystack: T, needle: Partial<T>, message?: string): void

  /**
   * Assert the collection to NOT include an item. Works for strings,
   * arrays and objects.
   *
   * @see {@link deepInclude} for nested object properties
   *
   * @example
   * assert.notInclude(
   *   { id: 1, name: 'virk' },
   *   { name: 'foo' }
   * ) // passes
   *
   * assert.notInclude([1, 2, 3], 4) // passes
   * assert.notInclude('hello world', 'bar') // passes
   *
   * @param ...args - The arguments to pass to the underlying assert.notInclude function.
   */
  notInclude(...args: Parameters<ChaiAssert['notInclude']>): ReturnType<ChaiAssert['notInclude']> {
    this.incrementAssertionsCount()
    return assert.notInclude(...args)
  }

  /**
   * Asserts that haystack includes needle. Deep equality is used.
   *
   * @param haystack - Container string.
   * @param needle - Potential substring of haystack.
   * @param message - Message to display on error.
   *
   * @deprecated Does not have any effect on string. Use {@link Assert#include} instead.
   */
  deepInclude(haystack: string, needle: string, message?: string): void

  /**
   * Asserts that haystack includes needle. Deep equality is used.
   *
   * @template T - Type of values in haystack.
   * @param haystack - Container array, set or map.
   * @param needle - Potential value contained in haystack.
   * @param message - Message to display on error.
   */
  deepInclude<T>(haystack: readonly T[] | ReadonlySet<T> | ReadonlyMap<any, T>, needle: T, message?: string): void

  /**
   * Asserts that haystack includes needle. Deep equality is used.
   *
   * @template T - Type of haystack.
   * @param haystack - Object.
   * @param needle - Potential subset of the haystack's properties.
   * @param message - Message to display on error.
   */
  deepInclude<T>(haystack: T, needle: T extends WeakSet<any> ? never : Partial<T>, message?: string): void

  /**
   * Assert the collection includes an item. Works for strings, arrays
   * and objects.
   *
   * @example
   * assert.deepInclude(
   *   { foo: { a: 1 }, bar: { b: 2 } },
   *   { foo: { a: 1 } }
   * ) // passes
   *
   * assert.deepInclude([1, [2], 3], [2]) // passes
   *
   * @param ...args - The arguments to pass to the underlying assert.deepInclude function.
   */
  deepInclude(...args: Parameters<ChaiAssert['deepInclude']>): ReturnType<ChaiAssert['deepInclude']> {
    this.incrementAssertionsCount()
    return assert.deepInclude(...args)
  }

  /**
   * Asserts that haystack does not include needle. Deep equality is used.
   *
   * @param haystack - Container string.
   * @param needle - Potential substring of haystack.
   * @param message - Message to display on error.
   *
   * @deprecated Does not have any effect on string. Use {@link Assert#notInclude} instead.
   */
  notDeepInclude(haystack: string, needle: string, message?: string): void

  /**
   * Asserts that haystack does not include needle. Deep equality is used.
   *
   * @template T - Type of values in haystack.
   * @param haystack - Container array, set or map.
   * @param needle - Potential value contained in haystack.
   * @param message - Message to display on error.
   */
  notDeepInclude<T>(haystack: readonly T[] | ReadonlySet<T> | ReadonlyMap<any, T>, needle: T, message?: string): void

  /**
   * Asserts that haystack does not include needle. Deep equality is used.
   *
   * @template T - Type of haystack.
   * @param haystack - Object.
   * @param needle - Potential subset of the haystack's properties.
   * @param message - Message to display on error.
   */
  notDeepInclude<T>(haystack: T, needle: T extends WeakSet<any> ? never : Partial<T>, message?: string): void

  /**
   * Assert the collection to NOT include an item. Works for strings,
   * arrays, and objects.
   *
   * @example
   * assert.notDeepInclude(
   *   { foo: { a: 1 }, bar: { b: 2 } },
   *   { foo: { a: 4 } }
   * ) // passes
   *
   * assert.notDeepInclude([1, [2], 3], [20]) // passes
   */
  notDeepInclude(...args: Parameters<ChaiAssert['notDeepInclude']>): ReturnType<ChaiAssert['notDeepInclude']> {
    this.incrementAssertionsCount()
    return assert.notDeepInclude(...args)
  }

  /**
   * Assert the value to match the given regular expression
   *
   * @example
   * assert.match('foobar', /^foo/) // passes
   *
   * @param value - String to match.
   * @param regexp - Regular expression to match against.
   * @param message - Message to display on error.
   */
  match(value: string, regexp: RegExp, message?: string): void {
    this.incrementAssertionsCount()
    return assert.match(value, regexp, message)
  }

  /**
   * Assert the value to NOT match the given regular expression
   *
   * @example
   * assert.notMatch('foobar', /^foo/) // fails
   *
   * @param value - String to not match.
   * @param regexp - Regular expression to not match against.
   * @param message - Message to display on error.
   */
  notMatch(value: string, regexp: RegExp, message?: string): void {
    this.incrementAssertionsCount()
    return assert.notMatch(value, regexp, message)
  }

  /**
   * Assert an object to contain a property
   *
   * @example
   * assert.property(
   *   { id: 1, username: 'virk' },
   *   'id'
   * ) // passes
   *
   * @param object - Object to check for property.
   * @param property - Property to check for.
   * @param message - Message to display on error.
   */
  property<T>(object: T, property: string /* keyof T */, message?: string): void {
    this.incrementAssertionsCount()
    return assert.property(object, property, message)
  }

  /**
   * Assert an object to NOT contain a property
   *
   * @example
   * assert.notProperty(
   *   { id: 1, username: 'virk' },
   *   'email'
   * ) // passes
   *
   * @param object - Object to check for property.
   * @param property - Property to check for.
   * @param message - Message to display on error.
   */
  notProperty<T>(object: T, property: string, message?: string): void {
    this.incrementAssertionsCount()
    return assert.notProperty(object, property, message)
  }

  /**
   * Assert an object property to match the expected value
   *
   * Use {@link deepPropertyVal} for deep comparing the value
   *
   * @example
   * assert.propertyVal(
   *   { id: 1, username: 'virk' },
   *   'id',
   *   1
   * ) // passes
   *
   * assert.propertyVal(
   *   { user: { id: 1 } },
   *   'user',
   *   { id: 1 }
   * ) // fails
   *
   * @template T - Type of object.
   * @template V - Type of value.
   * @param object - Container object.
   * @param property - Potential contained property of object.
   * @param value - Potential expected property value.
   * @param message - Message to display on error.
   */
  propertyVal<T, V>(object: T, property: string, /* keyof T */ value: V, message?: string): void {
    this.incrementAssertionsCount()
    return assert.nestedPropertyVal(object, property, value, message)
  }

  /**
   * Assert an object property to NOT match the expected value
   *
   * @example
   * assert.notPropertyVal(
   *   { id: 1, username: 'virk' },
   *   'id',
   *   22
   * ) // passes
   *
   * @template T - Type of object.
   * @template V - Type of value.
   * @param object - Container object.
   * @param property - Potential contained property of object.
   * @param value - Potential expected property value.
   * @param message - Message to display on error.
   */
  notPropertyVal<T, V>(object: T, property: string, value: V, message?: string): void {
    this.incrementAssertionsCount()
    return assert.notNestedPropertyVal(object, property, value, message)
  }

  /**
   * Assert an object property to deeply match the expected value
   *
   * @example
   * assert.deepPropertyVal(
   *   { user: { id: 1 } },
   *   'user',
   *   { id: 1 }
   * ) // passes
   *
   * @template T - Type of object.
   * @template V - Type of value.
   * @param object - Container object.
   * @param property - Potential contained property of object.
   * @param value - Potential expected property value.
   * @param message - Message to display on error.
   */
  deepPropertyVal<T, V>(object: T, property: string, value: V, message?: string): void {
    this.incrementAssertionsCount()
    return assert.deepNestedPropertyVal(object, property, value, message)
  }

  /**
   * Assert an object property to NOT deeply match the expected value
   *
   * @example
   * assert.notDeepPropertyVal(
   *   { user: { id: 1 } },
   *   'user',
   *   { email: 'foo@bar.com' }
   * ) // passes
   *
   * @template T - Type of object.
   * @template V - Type of value.
   * @param object - Container object.
   * @param property - Potential contained property of object.
   * @param value - Potential expected property value.
   * @param message - Message to display on error.
   */
  notDeepPropertyVal<T, V>(object: T, property: string, value: V, message?: string): void {
    this.incrementAssertionsCount()
    return assert.notDeepNestedPropertyVal(object, property, value, message)
  }

  /**
   * Assert length of an array, map or set to match the expected value
   *
   * @example
   * assert.lengthOf([1, 2, 3], 3)
   * assert.lengthOf(new Map([[1],[2]]), 2)
   * assert.lengthOf('hello world', 11)
   *
   * @template T - Type of object.
   * @param object - The object to check
   * @param length - The expected length
   * @param message - The error message to use if the length does not match
   */
  lengthOf<T extends { readonly length?: number | undefined } | { readonly size?: number | undefined }>(
    object: T,
    length: number,
    message?: string
  ): ReturnType<ChaiAssert['lengthOf']> {
    this.incrementAssertionsCount()
    return assert.lengthOf(object, length, message)
  }

  /**
   * Assert the object has all of the expected properties
   *
   * @example
   * assert.properties(
   *   { username: 'virk', age: 22, id: 1 },
   *   ['id', 'age']
   * ) // passes
   *
   * @template T - Type of object.
   * @param object - The object to check
   * @param keys - The expected keys
   * @param message - The error message to use if the keys do not match
   */
  properties<T>(
    object: T,
    keys: (object | string)[] | Record<string, any>,
    message?: string
  ): ReturnType<ChaiAssert['containsAllKeys']> {
    this.incrementAssertionsCount()
    return assert.containsAllKeys(object, keys, message)
  }

  /**
   * Assert the object has any of the expected properties
   *
   * @example
   * assert.anyProperties(
   *   { username: 'virk', age: 22, id: 1 },
   *   ['id', 'name', 'dob']
   * ) // passes
   *
   * @template T - Type of object.
   * @param object - The object to check
   * @param keys - The expected keys
   * @param message - The error message to use if the keys do not match
   */
  anyProperties<T>(
    object: T,
    keys: (object | string)[] | Record<string, any>,
    message?: string
  ): ReturnType<ChaiAssert['hasAnyKeys']> {
    this.incrementAssertionsCount()
    return assert.hasAnyKeys(object, keys, message)
  }

  /**
   * Assert the object has only the expected properties. Extra
   * properties will fail the assertion
   *
   * @example
   * assert.onlyProperties(
   *   { username: 'virk', age: 22, id: 1 },
   *   ['id', 'name', 'age']
   * ) // passes
   *
   * assert.onlyProperties(
   *   { username: 'virk', age: 22, id: 1 },
   *   ['id', 'name']
   * ) // fails
   *
   * @template T - Type of object.
   * @param object - The object to check
   * @param keys - The expected keys
   * @param message - The error message to use if the keys do not match
   */
  onlyProperties<T>(
    object: T,
    keys: (object | string)[] | Record<string, any>,
    message?: string
  ): ReturnType<ChaiAssert['hasAllKeys']> {
    this.incrementAssertionsCount()
    return assert.hasAllKeys(object, keys, message)
  }

  /**
   * Assert the object to not have any of the mentioned properties
   *
   * @example
   * assert.notAnyProperties(
   *   { id: 1, name: 'foo' },
   *   ['email', 'age']
   * ) // passes
   *
   * assert.notAnyProperties(
   *   { id: 1, name: 'foo' },
   *   ['email', 'id']
   * ) // fails
   *
   * @template T - Type of object.
   * @param object - The object to check
   * @param keys - The expected keys
   * @param message - The error message to use if the keys do not match
   */
  notAnyProperties<T>(
    object: T,
    keys: (object | string)[] | Record<string, any>,
    message?: string
  ): ReturnType<ChaiAssert['doesNotHaveAnyKeys']> {
    this.incrementAssertionsCount()
    return assert.doesNotHaveAnyKeys(object, keys, message)
  }

  /**
   * Assert the object to not have all of the mentioned properties
   *
   * @example
   * assert.notAllProperties(
   *   { id: 1, name: 'foo' },
   *   ['id', 'name', 'email']
   * ) // passes
   *
   * @template T - Type of object.
   * @param object - The object to check
   * @param keys - The expected keys
   * @param message - The error message to use if the keys do not match
   */
  notAllProperties<T>(
    object: T,
    keys: (object | string)[] | Record<string, any>,
    message?: string
  ): ReturnType<ChaiAssert['doesNotHaveAllKeys']> {
    this.incrementAssertionsCount()
    return assert.doesNotHaveAllKeys(object, keys, message)
  }

  /**
   * Expect the function to throw an exception.
   *
   * @see {@link rejects} for async function calls
   *
   * @example
   * function foo() { throw new Error('blow up') }
   *
   * assert.throws(foo) // passes
   *
   * @param fn - The function to throw
   * @returns The caught error object for further assertions
   */
  throws<T = any>(fn: () => unknown): T
  /**
   * Expect the function to throw an exception. Optionally, you can assert
   * for the exception class or message.
   *
   * @see {@link rejects} for async function calls
   *
   * @example
   * function foo() { throw new Error('blow up') }
   *
   * assert.throws(foo, Error) // passes
   * assert.throws(foo, 'blow up') // passes
   * assert.throws(foo, /blow/) // passes
   * assert.throws(foo, 'failed') // fails
   *
   * @param fn - The function to throw
   * @param errType - The error constructor, error message, or regular expression to match
   * @param message - The error message to use if the function does not throw
   * @returns The caught error object for further assertions
   */
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  throws<T = any>(fn: () => unknown, errType: RegExp | AnyErrorConstructor | string, message?: string): T
  /**
   * Expect the function to throw an exception. Optionally, you can assert
   * for the exception class or message.
   *
   * @see {@link rejects} for async function calls
   *
   * @example
   * function foo() { throw new Error('blow up') }
   *
   * assert.throws(foo, Error, 'blow up') // passes
   * assert.throws(foo, Error, /blow/) // passes
   *
   * @param fn - The function to throw
   * @param constructor - The error constructor to match
   * @param regExp - The error message or regular expression to match
   * @param message - The error message to use if the function does not throw
   * @returns The caught error object for further assertions
   */
  throws<T = any>(fn: () => unknown, constructor: AnyErrorConstructor, regExp: RegExp | string, message?: string): T
  /**
   * Expect the function to throw an exception. Optionally, you can assert
   * for the exception class or message.
   *
   * @see {@link rejects} for async function calls
   *
   * @param fn - The function to throw
   * @param errType - The error constructor, error message, or regular expression to match
   * @param regExp - The error message or regular expression to match
   * @param message - The error message to use if the function does not throw
   * @returns The caught error object for further assertions
   */
  throws(
    fn: () => unknown,
    errType?: RegExp | AnyErrorConstructor | string,
    regExp?: RegExp | string,
    message?: string
  ): any {
    this.incrementAssertionsCount()
    const args: [any, any?, ...any[]] = [fn]
    if (errType !== undefined) args.push(errType)
    if (regExp !== undefined) args.push(regExp)
    if (message !== undefined) args.push(message)
    return assert.throws(...args)
  }

  /**
   * Expect the function to not throw an exception.
   *
   * @see {@link rejects} for async function calls
   *
   * @example
   * assert.doesNotThrow(() => {}) // passes
   *
   * @param fn - The function to not throw
   */
  doesNotThrow(fn: () => unknown): void
  /**
   * Expect the function to not throw an exception. Optionally, you can assert
   * the exception is not from a certain class or have a certain message.
   *
   * @see {@link rejects} for async function calls
   *
   * @example
   * function foo() { throw new Error('blow up') }
   *
   * assert.doesNotThrow(foo) // fails
   * assert.doesNotThrow(foo, 'failed') // passes (because 'failed' does not match 'blow up')
   * assert.doesNotThrow(foo, /failed/) // passes
   *
   * @param fn - The function to not throw
   * @param errType - The error message or regular expression to not throw
   * @param message - The error message to use if the function throws
   */
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  doesNotThrow(fn: () => unknown, errType: RegExp | string, message?: string): void
  /**
   * Expect the function to not throw an exception. Optionally, you can assert
   * the exception is not from a certain class or have a certain message.
   *
   * @see {@link rejects} for async function calls
   *
   * @example
   * function foo() { throw new Error('blow up') }
   *
   * assert.doesNotThrow(foo, TypeError) // passes
   * assert.doesNotThrow(foo, Error) // fails
   *
   * @param fn - The function to not throw
   * @param constructor - The error constructor to not throw
   * @param message - The error message to use if the function throws
   */
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  doesNotThrow(fn: () => unknown, constructor: AnyErrorConstructor, message?: string): void
  /**
   * Expect the function to not throw an exception. Optionally, you can assert
   * the exception is not from a certain class or have a certain message.
   *
   * @see {@link rejects} for async function calls
   *
   * @param fn - The function to not throw
   * @param errType - The error constructor, message, or regex to not throw
   * @param message - The error message to use if the function throws
   */
  doesNotThrow(fn: () => unknown, errType?: RegExp | AnyErrorConstructor | string, message?: string): void {
    this.incrementAssertionsCount()
    const args: [any, any?, ...any[]] = [fn]
    if (errType !== undefined) args.push(errType)
    if (message !== undefined) args.push(message)
    return assert.doesNotThrow(...args)
  }

  /**
   * Assert the value is closer to the expected value + delta
   *
   * @example
   * assert.closeTo(10, 6, 8) // passes
   * assert.closeTo(10, 6, 4) // passes
   * assert.closeTo(10, 20, 10) // passes
   *
   * @param actual - The value to check
   * @param expected - Potential expected value.
   * @param delta - Maximum differenced between values.
   * @param message - The error message to use if the value is not within the delta range
   */
  closeTo(actual: number, expected: number, delta: number, message?: string): void {
    this.incrementAssertionsCount()
    return assert.closeTo(actual, expected, delta, message)
  }

  /**
   * Assert the value is equal to the expected value +/- delta range
   *
   * @example
   * assert.approximately(10, 6, 8) // passes
   * assert.approximately(10, 6, 4) // passes
   * assert.approximately(10, 20, 10) // passes
   *
   * @param actual - The value to check
   * @param expected - Potential expected value.
   * @param delta - Maximum differenced between values.
   * @param message - The error message to use if the value is not within the delta range
   */
  approximately(actual: number, expected: number, delta: number, message?: string): void {
    this.incrementAssertionsCount()
    return assert.approximately(actual, expected, delta, message)
  }

  /**
   * Assert two arrays to have same members. The values comparison
   * is same the `assert.equal` method.
   *
   * Use {@link sameDeepMembers} for deep comparison
   *
   * @example
   * assert.sameMembers(
   *   [1, 2, 3],
   *   [1, 2, 3]
   * ) // passes
   *
   * assert.sameMembers(
   *   [1, { id: 1 }, 3],
   *   [1, { id: 1 }, 3]
   * ) // fails
   *
   * @param set1 - Actual set of values.
   * @param set2 - Potential expected set of values.
   * @param message - The error message to use if the sets are not equal
   * @template T - The type of the values in the sets.
   */
  sameMembers<T>(set1: T[], set2: T[], message?: string): ReturnType<ChaiAssert['sameMembers']> {
    this.incrementAssertionsCount()
    return assert.sameMembers(set1, set2, message)
  }

  /**
   * Assert two arrays to NOT have same members. The values comparison
   * is same the `assert.notEqual` method.
   *
   * Use {@link notSameDeepMembers} for deep comparison
   *
   * @example
   * assert.notSameMembers(
   *   [1, { id: 1 }, 3],
   *   [1, { id: 1 }, 3]
   * ) // passes
   *
   * assert.notSameMembers(
   *   [1, 2, 3],
   *   [1, 2, 3]
   * ) // fails
   *
   * @param set1 - Actual set of values.
   * @param set2 - Potential expected set of values.
   * @param message - The error message to use if the sets are not equal
   * @template T - The type of the values in the sets.
   */
  notSameMembers<T>(set1: T[], set2: T[], message?: string): void {
    this.incrementAssertionsCount()
    // @ts-expect-error not in @types/chai
    return assert['notSameMembers'](set1, set2, message)
  }

  /**
   * Assert two arrays to have same members.
   *
   * @example
   * assert.sameDeepMembers(
   *   [1, 2, 3],
   *   [1, 2, 3]
   * ) // passes
   *
   * assert.sameDeepMembers(
   *   [1, { id: 1 }, 3],
   *   [1, { id: 1 }, 3]
   * ) // passes
   *
   * @param set1 - Actual set of values.
   * @param set2 - Potential expected set of values.
   * @param message - The error message to use if the sets are not equal
   * @template T - The type of the values in the sets.
   */
  sameDeepMembers<T>(set1: T[], set2: T[], message?: string): ReturnType<ChaiAssert['sameDeepMembers']> {
    this.incrementAssertionsCount()
    return assert.sameDeepMembers(set1, set2, message)
  }

  /**
   * Assert two arrays to NOT have same members.
   *
   * @example
   * assert.notSameDeepMembers(
   *   [1, { id: 1 }, 3],
   *   [1, { id: 2 }, 3]
   * ) // passes
   *
   * @param set1 - Actual set of values.
   * @param set2 - Potential expected set of values.
   * @param message - The error message to use if the sets are not equal
   * @template T - The type of the values in the sets.
   */
  notSameDeepMembers<T>(set1: T[], set2: T[], message?: string): ReturnType<ChaiAssert['sameDeepMembers']> {
    this.incrementAssertionsCount()
    return assert.notSameDeepMembers(set1, set2, message)
  }

  /**
   * Expect two arrays to have same members and in the same order.
   *
   * The values comparison is same the `assert.equal` method.
   * Use {@link sameDeepOrderedMembers} for deep comparison
   *
   * @example
   * assert.sameOrderedMembers(
   *   [1, 2, 3],
   *   [1, 2, 3]
   * ) // passes
   *
   * assert.sameOrderedMembers(
   *   [1, 3, 2],
   *   [1, 2, 3]
   * ) // fails
   *
   * @param set1 - Actual array of values.
   * @param set2 - Potential expected array of values.
   * @param message - The error message to use if the arrays are not equal.
   * @template T - The type of the values in the arrays.
   */
  sameOrderedMembers<T>(set1: T[], set2: T[], message?: string): ReturnType<ChaiAssert['sameOrderedMembers']> {
    this.incrementAssertionsCount()
    return assert.sameOrderedMembers(set1, set2, message)
  }

  /**
   * Expect two arrays to either have different members or in
   * different order
   *
   * The values comparison is same the `assert.notEqual` method.
   * Use {@link notSameDeepOrderedMembers} for deep comparison
   *
   * @example
   * assert.notSameOrderedMembers(
   *   [1, 2, 3],
   *   [1, 2, 3]
   * ) // passes
   *
   * assert.notSameOrderedMembers(
   *   [1, 3, 2],
   *   [1, 2, 3]
   * ) // fails
   *
   * @param set1 - Actual set of values.
   * @param set2 - Potential expected set of values.
   * @param message - The error message to use if the sets are not equal
   * @template T - The type of the values in the sets.
   */
  notSameOrderedMembers<T>(set1: T[], set2: T[], message?: string): ReturnType<ChaiAssert['notSameOrderedMembers']> {
    this.incrementAssertionsCount()
    return assert.notSameOrderedMembers(set1, set2, message)
  }

  /**
   * Expect two arrays to have same members and in the same order.
   *
   * The values comparison is same the `assert.deepEqual` method.
   *
   * @example
   * assert.sameDeepOrderedMembers(
   *   [1, { id: 1 }, { name: 'virk' }],
   *   [1, { id: 1 }, { name: 'virk' }]
   * ) // passes
   *
   * assert.sameDeepOrderedMembers(
   *   [1, { id: 1 }, { name: 'virk' }],
   *   [1, { name: 'virk' }, { id: 1 }]
   * ) // fails
   *
   * @param set1 - Actual array of values.
   * @param set2 - Potential expected array of values.
   * @param message - The error message to use if the arrays are not equal
   * @template T - The type of the values in the arrays.
   */
  sameDeepOrderedMembers<T>(set1: T[], set2: T[], message?: string): ReturnType<ChaiAssert['sameDeepOrderedMembers']> {
    this.incrementAssertionsCount()
    return assert.sameDeepOrderedMembers(set1, set2, message)
  }

  /**
   * Expect two arrays to either have different members or in
   * different order
   *
   * The values comparison is same the `assert.notDeepEqual` method.
   * Use {@link notSameDeepOrderedMembers} for deep comparison
   *
   * @example
   * assert.notSameDeepOrderedMembers(
   *   [1, { id: 1 }, { name: 'virk' }],
   *   [1, { name: 'virk' }, { id: 1 }]
   * ) // passes
   *
   * assert.notSameDeepOrderedMembers(
   *   [1, { id: 1 }, { name: 'virk' }],
   *   [1, { id: 1 }, { name: 'virk' }]
   * ) // fails
   *
   * @param set1 - Actual array of values.
   * @param set2 - Potential expected array of values.
   * @param message - The error message to use if the arrays are not equal
   * @template T - The type of the values in the arrays.
   */
  notSameDeepOrderedMembers<T>(
    set1: T[],
    set2: T[],
    message?: string
  ): ReturnType<ChaiAssert['notSameDeepOrderedMembers']> {
    this.incrementAssertionsCount()
    return assert.notSameDeepOrderedMembers(set1, set2, message)
  }

  /**
   * Assert the expected array is a subset of a given array.
   *
   * The values comparison is same the `assert.equal` method.
   * Use {@link includeDeepMembers} for deep comparison.
   *
   * @example
   * assert.includeMembers([1, 2, 4, 5], [1, 2]) // passes
   * assert.includeMembers([1, 2, 4, 5], [1, 3]) // fails
   *
   * @param superset - Actual set of values.
   * @param subset - Potential contained set of values.
   * @param message - The error message to use if the arrays are not equal
   * @template T - The type of the values in the arrays.
   */
  includeMembers<T>(superset: T[], subset: T[], message?: string): ReturnType<ChaiAssert['includeMembers']> {
    this.incrementAssertionsCount()
    return assert.includeMembers(superset, subset, message)
  }

  /**
   * Assert the expected array is NOT a subset of a given array.
   *
   * The values comparison is same the `assert.notEqual` method.
   * Use {@link notIncludeDeepMembers} for deep comparison.
   *
   * @example
   * assert.notIncludeMembers([1, 2, 4, 5], [1, 3]) // passes
   * assert.notIncludeMembers([1, 2, 4, 5], [1, 2]) // fails
   *
   * @param superset - Actual set of values.
   * @param subset - Potential contained set of values.
   * @param message - The error message to use if the arrays are not equal
   * @template T - The type of the values in the arrays.
   */
  notIncludeMembers<T>(superset: T[], subset: T[], message?: string): ReturnType<ChaiAssert['notIncludeMembers']> {
    this.incrementAssertionsCount()
    return assert.notIncludeMembers(superset, subset, message)
  }

  /**
   * Assert the expected array is a subset of a given array.
   *
   * The values comparison is same the `assert.deepEqual` method.
   *
   * @example
   * assert.includeDeepMembers(
   *   [{ id: 1 }, { id: 2 }],
   *   [{ id: 2 }]
   * ) // passes
   *
   * assert.includeDeepMembers(
   *   [{ id: 1 }, { id: 2 }],
   *   [{ id: 3 }]
   * ) // fails
   *
   * @param superset - Actual set of values.
   * @param subset - Potential contained set of values.
   * @param message - The error message to use if the arrays are not equal
   * @template T - The type of the values in the arrays.
   */
  includeDeepMembers<T>(superset: T[], subset: T[], message?: string): ReturnType<ChaiAssert['includeDeepMembers']> {
    this.incrementAssertionsCount()
    return assert.includeDeepMembers(superset, subset, message)
  }

  /**
   * Assert the expected array is NOT a subset of a given array.
   *
   * The values comparison is same the `assert.notDeepEqual` method.
   *
   * @example
   * assert.notIncludeDeepMembers(
   *   [{ id: 1 }, { id: 2 }],
   *   [{ id: 3 }]
   * ) // passes
   *
   * assert.notIncludeDeepMembers(
   *   [{ id: 1 }, { id: 2 }],
   *   [{ id: 2 }]
   * ) // fails
   *
   * @param superset - Actual set of values.
   * @param subset - Potential contained set of values.
   * @param message - The error message to use if the arrays are not equal
   * @template T - The type of the values in the arrays.
   */
  notIncludeDeepMembers<T>(
    superset: T[],
    subset: T[],
    message?: string
  ): ReturnType<ChaiAssert['notIncludeDeepMembers']> {
    this.incrementAssertionsCount()
    return assert.notIncludeDeepMembers(superset, subset, message)
  }

  /**
   * Assert the expected array is a subset of a given array and
   * in the same order
   *
   * The values comparison is same the `assert.equal` method.
   * Use {@link includeDeepOrderedMembers} for deep comparison.
   *
   * @example
   * assert.includeOrderedMembers(
   *   [1, 2, 4, 5],
   *   [1, 2, 4]
   * ) // passes
   *
   * assert.includeOrderedMembers(
   *   [1, 2, 4, 5],
   *   [1, 4, 2]
   * ) // fails
   *
   * assert.includeOrderedMembers(
   *   [1, 2, 4, 5],
   *   [1, 2, 5]
   * ) // fails
   *
   * @param superset - Actual set of values.
   * @param subset - Potential contained set of values.
   * @param message - The error message to use if the arrays are not equal
   * @template T - The type of the values in the arrays.
   */
  includeOrderedMembers<T>(
    superset: T[],
    subset: T[],
    message?: string
  ): ReturnType<ChaiAssert['includeOrderedMembers']> {
    this.incrementAssertionsCount()
    return assert.includeOrderedMembers(superset, subset, message)
  }

  /**
   * Assert the expected array is either not a subset of
   * a given array or is not in the same order.
   *
   * The values comparison is same the `assert.notEqual` method.
   * Use {@link notIncludeDeepOrderedMembers} for deep comparison.
   *
   * @example
   *
   * assert.notIncludeOrderedMembers(
   *   [1, 2, 4, 5],
   *   [1, 4, 2]
   * ) // passes
   *
   * assert.notIncludeOrderedMembers(
   *   [1, 2, 4, 5],
   *   [1, 2, 5]
   * ) // passes
   *
   * assert.notIncludeOrderedMembers(
   *   [1, 2, 4, 5],
   *   [1, 2, 4]
   * ) // fails
   *
   * @param superset - Actual set of values.
   * @param subset - Potential contained set of values.
   * @param message - The error message to use if the arrays are not equal
   * @template T - The type of the values in the arrays.
   */
  notIncludeOrderedMembers<T>(
    superset: T[],
    subset: T[],
    message?: string
  ): ReturnType<ChaiAssert['notIncludeOrderedMembers']> {
    this.incrementAssertionsCount()
    return assert.notIncludeOrderedMembers(superset, subset, message)
  }

  /**
   * Assert the expected array is a subset of a given array and
   * in the same order
   *
   * The values comparison is same the `assert.deepEqual` method.
   *
   * @example
   * assert.includeDeepOrderedMembers(
   *   [{ id: 1 }, { id: 2 }, { id: 4 }],
   *   [{ id: 1 }, { id: 2 }]
   * ) // passes
   *
   * assert.includeDeepOrderedMembers(
   *   [{ id: 1 }, { id: 2 }, { id: 4 }],
   *   [{ id: 1 }, { id: 4 }]
   * ) // fails
   *
   * assert.includeDeepOrderedMembers(
   *   [{ id: 1 }, { id: 2 }, { id: 4 }],
   *   [{ id: 1 }, { id: 4 }, { id: 2 }]
   * ) // fails
   *
   * @param superset - Actual set of values.
   * @param subset - Potential contained set of values.
   * @param message - The error message to use if the arrays are not equal
   * @template T - The type of the values in the arrays.
   */
  includeDeepOrderedMembers<T>(
    superset: T[],
    subset: T[],
    message?: string
  ): ReturnType<ChaiAssert['includeDeepOrderedMembers']> {
    this.incrementAssertionsCount()
    return assert.includeDeepOrderedMembers(superset, subset, message)
  }

  /**
   * Assert the expected array is either not a subset of
   * a given array or is not in the same order.
   *
   * The values comparison is same the `assert.notDeepEqual` method.
   *
   * @example
   *
   * assert.notIncludeDeepOrderedMembers(
   *   [{ id: 1 }, { id: 2 }, { id: 4 }],
   *   [{ id: 1 }, { id: 4 }]
   * ) // passes
   *
   * assert.notIncludeDeepOrderedMembers(
   *   [{ id: 1 }, { id: 2 }, { id: 4 }],
   *   [{ id: 1 }, { id: 4 }, { id: 2 }]
   * ) // passes
   *
   * assert.notIncludeDeepOrderedMembers(
   *   [{ id: 1 }, { id: 2 }, { id: 4 }],
   *   [{ id: 1 }, { id: 2 }]
   * ) // fails
   *
   * @param superset - Actual set of values.
   * @param subset - Potential contained set of values.
   * @param message - The error message to use if the arrays are not equal
   * @template T - The type of the values in the arrays.
   */
  notIncludeDeepOrderedMembers<T>(
    superset: T[],
    subset: T[],
    message?: string
  ): ReturnType<ChaiAssert['notIncludeDeepOrderedMembers']> {
    this.incrementAssertionsCount()
    return assert.notIncludeDeepOrderedMembers(superset, subset, message)
  }

  /**
   * Assert the object is sealed.
   *
   * @example
   * assert.isSealed(Object.seal({})) // passes
   * assert.isSealed({}) // fails
   *
   * @param object - Actual value.
   * @param message - Message to display when the assertion fails.
   * @template T - Type of the object.
   */
  isSealed<T>(object: T, message?: string): ReturnType<ChaiAssert['isSealed']> {
    this.incrementAssertionsCount()
    return assert.isSealed(object, message)
  }

  /**
   * Assert the object is sealed.
   *
   * @remarks
   * Alias for {@link isSealed}
   *
   * @example
   * assert.sealed(Object.seal({})) // passes
   * assert.sealed({}) // fails
   *
   * @param object - Actual value.
   * @param message - Message to display when the assertion fails.
   * @template T - Type of the object.
   */
  sealed<T>(object: T, message?: string): ReturnType<ChaiAssert['isSealed']> {
    this.incrementAssertionsCount()
    return assert.sealed(object, message)
  }

  /**
   * Assert the object is not sealed.
   *
   * @example
   * assert.isNotSealed({}) // passes
   * assert.isNotSealed(Object.seal({})) // fails
   *
   * @param object - Actual value.
   * @param message - Message to display when the assertion fails.
   * @template T - Type of the object.
   */
  isNotSealed<T>(object: T, message?: string): ReturnType<ChaiAssert['isNotSealed']> {
    this.incrementAssertionsCount()
    return assert.isNotSealed(object, message)
  }

  /**
   * Assert the object is not sealed.
   *
   * @remarks
   * Alias for {@link isNotSealed}
   *
   * @example
   * assert.notSealed({}) // passes
   * assert.notSealed(Object.seal({})) // fails
   *
   * @param object - Actual value.
   * @param message - Message to display when the assertion fails.
   * @template T - Type of the object.
   */
  notSealed<T>(object: T, message?: string): ReturnType<ChaiAssert['notSealed']> {
    this.incrementAssertionsCount()
    return assert.notSealed(object, message)
  }

  /**
   * Assert the object is frozen.
   *
   * @example
   * assert.isFrozen(Object.freeze({})) // passes
   * assert.isFrozen({}) // fails
   *
   * @param object - Actual value.
   * @param message - Message to display when the assertion fails.
   * @template T - Type of the object.
   */
  isFrozen<T>(object: T, message?: string): ReturnType<ChaiAssert['isFrozen']> {
    this.incrementAssertionsCount()
    return assert.isFrozen(object, message)
  }

  /**
   * Assert the object is frozen.
   *
   * @remarks
   * Alias for {@link isFrozen}
   *
   * @example
   * assert.frozen(Object.freeze({})) // passes
   * assert.frozen({}) // fails
   *
   * @param object - Actual value.
   * @param message - Message to display when the assertion fails.
   * @template T - Type of the object.
   */
  frozen<T>(object: T, message?: string): ReturnType<ChaiAssert['frozen']> {
    this.incrementAssertionsCount()
    return assert.frozen(object, message)
  }

  /**
   * Assert the object is not frozen.
   *
   * @example
   * assert.isNotFrozen({}) // passes
   * assert.isNotFrozen(Object.freeze({})) // fails
   *
   * @param object - Actual value.
   * @param message - Message to display when the assertion fails.
   * @template T - Type of the object.
   */
  isNotFrozen<T>(object: T, message?: string): ReturnType<ChaiAssert['isNotFrozen']> {
    this.incrementAssertionsCount()
    return assert.isNotFrozen(object, message)
  }

  /**
   * Assert the object is not frozen.
   *
   * @remarks
   * Alias for {@link isNotFrozen}
   *
   * @example
   * assert.notFrozen({}) // passes
   * assert.notFrozen(Object.freeze({})) // fails
   *
   * @param object - Actual value.
   * @param message - Message to display when the assertion fails.
   * @template T - Type of the object.
   */
  notFrozen<T>(object: T, message?: string): ReturnType<ChaiAssert['notFrozen']> {
    this.incrementAssertionsCount()
    return assert.notFrozen(object, message)
  }

  /**
   * Assert value to be empty
   *
   * @example
   * assert.isEmpty([]) // passes
   * assert.isEmpty({}) // passes
   * assert.isEmpty('') // passes
   *
   * @param target - Value to check.
   * @param message - Message to display when the assertion fails.
   * @template T - Type of the value.
   */
  isEmpty<T>(target: T, message?: string): ReturnType<ChaiAssert['isEmpty']> {
    this.incrementAssertionsCount()
    return assert.isEmpty(target, message)
  }

  /**
   * Assert value to be empty
   *
   * @remarks
   * Alias for {@link isEmpty}
   *
   * @example
   * assert.empty([]) // passes
   * assert.empty({}) // passes
   * assert.empty('') // passes
   *
   * @param target - Value to check.
   * @param message - Message to display when the assertion fails.
   * @template T - Type of the value.
   */
  empty<T>(target: T, message?: string): ReturnType<ChaiAssert['isEmpty']> {
    this.incrementAssertionsCount()
    return assert.isEmpty(target, message)
  }

  /**
   * Assert value to not be empty
   *
   * @example
   * assert.isNotEmpty([1, 2]) // passes
   * assert.isNotEmpty({ foo: 'bar' }) // passes
   * assert.isNotEmpty('hello') // passes
   *
   * @param target - Value to check.
   * @param message - Message to display when the assertion fails.
   * @template T - Type of the value.
   */
  isNotEmpty<T>(target: T, message?: string): ReturnType<ChaiAssert['isNotEmpty']> {
    this.incrementAssertionsCount()
    return assert.isNotEmpty(target, message)
  }

  /**
   * Assert value to not be empty
   *
   * @remarks
   * Alias for {@link isNotEmpty}
   *
   * @example
   * assert.notEmpty([1, 2]) // passes
   * assert.notEmpty({ foo: 'bar' }) // passes
   * assert.notEmpty('hello') // passes
   *
   * @param target - Value to check.
   * @param message - Message to display when the assertion fails.
   * @template T - Type of the value.
   */
  notEmpty<T>(target: T, message?: string): ReturnType<ChaiAssert['isNotEmpty']> {
    this.incrementAssertionsCount()
    return assert.isNotEmpty(target, message)
  }

  /**
   * Assert an array or an object to contain a subset of the expected
   * value. Useful for testing API responses.
   *
   * @example
   * assert.containSubset(
   *   { id: 1, created_at: Date },
   *   { id: 1 }
   * ) // passes
   *
   * assert.containSubset(
   *   [
   *     { id: 1, created_at: Date },
   *     { id: 2, created_at: Date }
   *   ],
   *   [{ id: 1 }, { id: 2 }]
   * ) // passes
   *
   * @param haystack - The array or object to check
   * @param needle - The subset to check for
   * @param message - The error message to use if the subset is found
   */
  containSubset(haystack: any, needle: any, message?: string) {
    this.incrementAssertionsCount()
    return assert.containSubset(haystack, needle, message)
  }

  /**
   * Assert an array or an object does not contain a subset of the
   * expected value. Useful for testing API responses.
   *
   * @example
   * assert.doesNotContainSubset(
   *   { id: 1, created_at: Date },
   *   { name: 'foo' }
   * ) // passes
   *
   * assert.doesNotContainSubset(
   *   [
   *     { id: 1, created_at: Date },
   *     { id: 2, created_at: Date }
   *   ],
   *   [{ name: 'foo' }, { id: 2 }]
   * ) // passes
   *
   * @param haystack - The array or object to check
   * @param needle - The subset to check for
   * @param message - The error message to use if the subset is found
   */
  doesNotContainSubset(haystack: any, needle: any, message?: string) {
    this.incrementAssertionsCount()
    return assert.doesNotContainSubset(haystack, needle, message)
  }

  /**
   * Assert an array or an object to contain a subset of the expected
   * value. Useful for testing API responses.
   *
   * @deprecated Instead use "containSubset"
   * @example
   * assert.containsSubset(
   *   { id: 1, created_at: Date },
   *   { id: 1 }
   * ) // passes
   *
   * assert.containsSubset(
   *   [
   *     { id: 1, created_at: Date },
   *     { id: 2, created_at: Date }
   *   ],
   *   [{ id: 1 }, { id: 2 }]
   * ) // passes
   *
   * @param haystack - The array or object to check
   * @param needle - The subset to check for
   * @param message - The error message to use if the subset is found
   */
  containsSubset(haystack: any, needle: any, message?: string) {
    return this.containSubset(haystack, needle, message)
  }

  /**
   * Assert an array or an object to not contain a subset of the expected
   * value.
   *
   * @deprecated Instead use "doesNotContainSubset"
   * @example
   * assert.notContainsSubset(
   *   { id: 1, created_at: Date },
   *   { email: 'foo@bar.com' }
   * ) // passes
   *
   * @param haystack - The array or object to check
   * @param needle - The subset to check for
   * @param message - The error message to use if the subset is found
   */
  notContainsSubset(haystack: any, needle: any, message?: string) {
    return this.doesNotContainSubset(haystack, needle, message)
  }

  /**
   * Assert the value is available in the provided list.
   *
   * @example
   * assert.oneOf('foo', ['foo', 'bar', 'baz']) // passes
   * assert.oneOf('foo', ['bar', 'baz']) // fails
   *
   * @param inList - Value expected to be in the list.
   * @param list - The list of values to check against.
   * @param message - The error message to use if the value is not in the list.
   * @template T - Type of the values.
   */
  oneOf<T>(inList: T, list: T[], message?: string): ReturnType<ChaiAssert['oneOf']> {
    this.incrementAssertionsCount()
    return assert.oneOf(inList, list, message)
  }

  /**
   * Assert the function to reject the promise or reject with a specific
   * error class/message
   *
   * The method returns a promise
   *
   * @example
   * await assert.reject(() => throw new Error(''))
   *
   * @param fn - The function to reject
   * @param errMessage - The error message to use if the function does not reject
   * @returns The caught error object for further assertions
   */
  async rejects<T = any>(fn: () => unknown | Promise<unknown>, errMessage?: string): Promise<T>
  /**
   * Assert the function to reject the promise or reject with a specific
   * error class/message
   *
   * The method returns a promise
   *
   * @example
   * await assert.reject(() => throw new Error(''))
   *
   * @param fn - The function to reject
   * @param errType - The error type to reject with
   * @param errMessage - The error message to use if the function does not reject
   * @returns The caught error object for further assertions
   */
  async rejects<T = any>(
    fn: () => unknown | Promise<unknown>,
    errType: ExpectedErrorPattern | AnyErrorConstructor,
    errMessage?: string
  ): Promise<T>
  /**
   * Assert the function to reject the promise or reject with a specific
   * error class/message
   *
   * The method returns a promise
   *
   * @example
   * await assert.reject(() => throw new Error(''))
   *
   * @param fn - The function to reject
   * @param constructor - The error constructor to reject with
   * @param regExp - The error message to reject with
   * @param errMessage - The error message to use if the function does not reject
   * @returns The caught error object for further assertions
   */
  async rejects<T = any>(
    fn: () => unknown | Promise<unknown>,
    constructor: AnyErrorConstructor,
    regExp: ExpectedErrorPattern,
    errMessage?: string
  ): Promise<T>
  /**
   * Assert the function to reject the promise or reject with a specific
   * error class/message
   *
   * The method returns a promise
   *
   * @example
   * await assert.reject(() => throw new Error(''))
   *
   * @param fn - The function to reject
   * @param errType - The error type to reject with
   * @param regExp - The error message to reject with
   * @param errMessage - The error message to use if the function does not reject
   * @returns The caught error object for further assertions
   */
  async rejects(
    fn: () => unknown | Promise<unknown>,
    errType?: ExpectedErrorPattern | AnyErrorConstructor,
    regExp?: ExpectedErrorPattern,
    errMessage?: string
  ): Promise<any> {
    let raisedException: any = null
    this.incrementAssertionsCount()

    /**
     * Fn should be a valid function
     */
    if (typeof fn !== 'function') {
      return this.evaluate(false, 'expected #{this} to be a function', {
        thisObject: fn,
        expected: '',
        actual: '',
        prefix: errMessage,
        operator: 'rejects',
      })
    }

    /**
     * Invoke the function
     */
    try {
      await fn()
    } catch (error) {
      raisedException = error
    }

    /**
     * Normalizing values
     */
    const expectedExceptionClass = errType && typeof errType === 'function' ? errType : null
    let pattern: unknown = undefined
    if (regExp !== undefined) {
      pattern = regExp
    } else if (errType !== undefined && typeof errType !== 'function') {
      pattern = errType
    }

    /**
     * No exception was raised
     */
    if (!raisedException) {
      return this.evaluate(false, 'expected #{this} to throw an error', {
        thisObject: fn,
        expected: '',
        actual: '',
        prefix: errMessage,
        operator: 'rejects',
      })
    }

    /**
     * Expected constructors are different
     */
    if (expectedExceptionClass && raisedException instanceof expectedExceptionClass === false) {
      return this.evaluate(false, 'expected #{this} to throw #{exp} but #{act} was thrown', {
        thisObject: fn,
        expected: expectedExceptionClass,
        actual: raisedException,
        prefix: errMessage,
        operator: 'rejects',
      })
    }

    /**
     * Message pattern checks
     */
    if (pattern !== undefined) {
      const matchResult = this.#matchExpectedMessage(raisedException.message, pattern)
      if (matchResult.hasBrowserValue !== false && !matchResult.matches) {
        const template = matchResult.isRegex
          ? 'expected #{this} to throw error matching #{exp} but got #{act}'
          : 'expected #{this} to throw error including #{exp} but got #{act}'
        return this.evaluate(false, template, {
          thisObject: fn,
          expected: matchResult.expectedDescription,
          actual: raisedException.message,
          prefix: errMessage,
          operator: 'rejects',
        })
      }
    }

    return raisedException
  }

  /**
   * Returns the current browser name ('chromium', 'firefox', or 'webkit') based on
   * Lupa context or user-agent detection.
   */
  getBrowserName(): 'chromium' | 'firefox' | 'webkit' {
    if (typeof window !== 'undefined' && window.__lupa__?.browserName) {
      return window.__lupa__.browserName as 'chromium' | 'firefox' | 'webkit'
    }
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase()
      if (ua.includes('firefox')) {
        return 'firefox'
      }
      if (ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium')) {
        return 'webkit'
      }
    }
    return 'chromium'
  }

  /**
   * Assert that a promise or function rejects with a standard browser fetch network error.
   *
   * Accounts for cross-browser differences:
   * - Chromium: TypeError "Failed to fetch"
   * - Firefox: TypeError containing "NetworkError"
   * - WebKit: TypeError "Load failed"
   *
   * @param fn - The function or promise expected to reject
   * @param errMessage - Custom assertion failure message
   */
  async rejectsNetworkError(fn: () => unknown | Promise<unknown>, errMessage?: string): Promise<unknown> {
    return this.rejects(
      fn,
      TypeError,
      {
        chromium: 'Failed to fetch',
        firefox: /NetworkError/,
        webkit: 'Load failed',
      },
      errMessage
    )
  }

  /**
   * Assert the function does not rejects the promise or the rejection
   * does not match the expectations.
   *
   * The method returns a promise
   *
   * @example
   * await assert.doesNotReject(
   *   async () => throw new Error('foo'),
   *   HttpError
   * ) // passes: Error !== HttpError
   *
   * await assert.doesNotReject(
   *   async () => throw new HttpError('Resource not found'),
   *   HttpError,
   *   'Server not available'
   * ) // passes: Resource not found !== Server not available
   *
   * await assert.doesNotReject(
   *   async () => return 'foo',
   * ) // passes
   *
   * @param fn - The function to reject
   * @param message - The error message to use if the function does not reject
   */
  async doesNotReject(fn: () => unknown, message?: string): Promise<void>
  /**
   * Assert the function does not reject the promise or the rejection
   * does not match the expectations.
   *
   * The method returns a promise
   *
   * @example
   * await assert.doesNotReject(
   *   async () => throw new Error('foo'),
   *   HttpError
   * ) // passes: Error !== HttpError
   *
   * await assert.doesNotReject(
   *   async () => throw new HttpError('Resource not found'),
   *   HttpError,
   *   'Server not available'
   * ) // passes: Resource not found !== Server not available
   *
   * await assert.doesNotReject(
   *   async () => return 'foo',
   * ) // passes
   *
   * @param fn - The function to reject
   * @param errType - The error type to reject with
   * @param message - The error message to use if the function does not reject
   */
  async doesNotReject(
    fn: () => unknown | Promise<unknown>,
    errType: ExpectedErrorPattern | AnyErrorConstructor,
    message?: string
  ): Promise<void>
  /**
   * Assert the function does not reject the promise or the rejection
   * does not match the expectations.
   *
   * The method returns a promise
   *
   * @example
   * await assert.doesNotReject(
   *   async () => throw new Error('foo'),
   *   HttpError
   * ) // passes: Error !== HttpError
   *
   * await assert.doesNotReject(
   *   async () => throw new HttpError('Resource not found'),
   *   HttpError,
   *   'Server not available'
   * ) // passes: Resource not found !== Server not available
   *
   * await assert.doesNotReject(
   *   async () => return 'foo',
   * ) // passes
   *
   * @param fn - The function to reject
   * @param constructor - The error constructor to reject with
   * @param regExp - The error message to reject with
   * @param message - The error message to use if the function does not reject
   */
  async doesNotReject(
    fn: () => unknown | Promise<unknown>,
    constructor: AnyErrorConstructor,
    regExp: ExpectedErrorPattern,
    message?: string
  ): Promise<void>
  /**
   * Assert the function does not reject the promise or the rejection
   * does not match the expectations.
   *
   * The method returns a promise
   *
   * @example
   * await assert.doesNotReject(
   *   async () => throw new Error('foo'),
   *   HttpError
   * ) // passes: Error !== HttpError
   *
   * await assert.doesNotReject(
   *   async () => throw new HttpError('Resource not found'),
   *   HttpError,
   *   'Server not available'
   * ) // passes: Resource not found !== Server not available
   *
   * await assert.doesNotReject(
   *   async () => return 'foo',
   * ) // passes
   *
   * @param fn - The function to reject
   * @param errType - The error type to reject with
   * @param regExp - The error message to reject with
   * @param message - The error message to use if the function does not reject
   */
  async doesNotReject(
    fn: () => unknown | Promise<unknown>,
    errType?: ExpectedErrorPattern | AnyErrorConstructor,
    regExp?: ExpectedErrorPattern,
    message?: string
  ): Promise<void> {
    this.incrementAssertionsCount()
    let raisedException: any = null

    /**
     * Fn should be a valid function
     */
    if (typeof fn !== 'function') {
      return this.evaluate(false, 'expected #{this} to be a function', {
        thisObject: fn,
        expected: '',
        actual: '',
        prefix: message,
        operator: 'doesNotReject',
      })
    }

    /**
     * Invoke the function
     */
    try {
      await fn()
    } catch (error) {
      raisedException = error
    }

    /**
     * No exception was raised (as expected)
     */
    if (!raisedException) {
      return
    }

    /**
     * Normalizing values
     */
    const expectedExceptionClass = errType && typeof errType === 'function' ? errType : null
    let pattern: unknown = undefined
    if (regExp !== undefined) {
      pattern = regExp
    } else if (errType !== undefined && typeof errType !== 'function') {
      pattern = errType
    }

    const hasMatchingErrorClass = expectedExceptionClass && raisedException instanceof expectedExceptionClass

    /**
     * Exception was raised and caller is not trying to narrow down the exception
     */
    if (pattern === undefined && !expectedExceptionClass) {
      return this.evaluate(false, 'expected #{this} to not throw an error but #{act} was thrown', {
        thisObject: fn,
        expected: expectedExceptionClass,
        actual: raisedException,
        prefix: message,
        operator: 'doesNotReject',
      })
    }

    /**
     * An exception was raised for the expected error constructor, and no pattern check was requested
     */
    if (hasMatchingErrorClass && pattern === undefined) {
      return this.evaluate(false, 'expected #{this} to not throw #{exp} but #{act} was thrown', {
        thisObject: fn,
        expected: expectedExceptionClass,
        actual: raisedException,
        prefix: message,
        operator: 'doesNotReject',
      })
    }

    /**
     * Message pattern checks (only if constructor matched or constructor was not specified)
     */
    if (pattern !== undefined && (expectedExceptionClass === null || hasMatchingErrorClass)) {
      const matchResult = this.#matchExpectedMessage(raisedException.message, pattern)
      if (matchResult.hasBrowserValue !== false && matchResult.matches) {
        return this.evaluate(
          false,
          hasMatchingErrorClass
            ? 'expected #{this} to not throw #{exp} but #{act} was thrown'
            : matchResult.isRegex
              ? 'expected #{this} to throw error not matching #{exp}'
              : 'expected #{this} to throw error not including #{exp}',
          {
            thisObject: fn,
            expected: hasMatchingErrorClass ? expectedExceptionClass : matchResult.expectedDescription,
            actual: hasMatchingErrorClass ? raisedException : raisedException.message,
            prefix: message,
            operator: 'doesNotReject',
          }
        )
      }
    }
  }

  /**
   * Asserts that a given DOM element or NodeList has no accessibility violations
   * according to axe-core.
   *
   * @example
   * await assert.isAccessible(document.body)
   */
  async isAccessible(element: Element | NodeList | string, options?: axe.RunOptions): Promise<void> {
    return assertIsAccessible(this, element, options)
  }

  /**
   * Helper to recursively match the actual error message against expected error patterns.
   */
  #matchExpectedMessage(
    actual: string,
    expected: unknown
  ): { matches: boolean; expectedDescription: unknown; isRegex: boolean; hasBrowserValue?: boolean } {
    if (expected === undefined || expected === null) {
      return { matches: true, expectedDescription: '', isRegex: false }
    }

    if (typeof expected === 'object' && !(expected instanceof RegExp) && !Array.isArray(expected)) {
      const browser = this.getBrowserName()
      const hasKey = Object.prototype.hasOwnProperty.call(expected, browser)
      if (!hasKey) {
        return { matches: false, expectedDescription: '', isRegex: false, hasBrowserValue: false }
      }
      const browserValue = (expected as Record<string, unknown>)[browser]
      const res = this.#matchExpectedMessage(actual, browserValue)
      return { ...res, hasBrowserValue: true }
    }

    if (Array.isArray(expected)) {
      const results = expected.map((item) => this.#matchExpectedMessage(actual, item))
      const matched = results.some((r) => r.matches)
      const descriptions = expected.map((item) => (item instanceof RegExp ? item.toString() : `'${item}'`))
      const desc = `one of [${descriptions.join(', ')}]`
      if (matched) {
        return { matches: true, expectedDescription: desc, isRegex: true }
      }
      return {
        matches: false,
        expectedDescription: desc,
        isRegex: true,
      }
    }

    if (expected instanceof RegExp) {
      return {
        matches: expected.test(actual),
        expectedDescription: expected,
        isRegex: true,
      }
    }

    return {
      matches: actual === String(expected),
      expectedDescription: expected,
      isRegex: false,
    }
  }
}
