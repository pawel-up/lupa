// Imports calculator as a transitive dependency — used to verify cascade works
import { add, PI } from './calculator.js'

export function circleArea(radius: number): number {
  return multiply(PI, radius, radius)
}

function multiply(a: number, b: number, c: number): number {
  return a * b * c
}

export function sumAll(...nums: number[]): number {
  return nums.reduce((acc, n) => add(acc, n), 0)
}
