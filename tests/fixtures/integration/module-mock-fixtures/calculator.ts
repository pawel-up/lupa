export const PI = 3.14159

export function add(a: number, b: number): number {
  return a + b
}

export function multiply(a: number, b: number): number {
  return a * b
}

export default class Calculator {
  history: string[] = []

  add(a: number, b: number): number {
    const result = add(a, b)
    this.history.push(`${a} + ${b} = ${result}`)
    return result
  }
}
