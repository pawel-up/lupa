export interface RetryOptions {
  /**
   * The maximum amount of times to retry the operation. Default is 10.
   */
  retries?: number
  /**
   * The exponential factor to use. Default is 2.
   */
  factor?: number
  /**
   * Initial delay in milliseconds between retries. Default is 1000.
   */
  minTimeout?: number
  /**
   * Maximum delay in milliseconds between retries. Default is 30000.
   */
  maxTimeout?: number
  /**
   * Custom delay callback returning delay in milliseconds for attempt N.
   */
  delay?: (attempt: number) => number
}

export function retry<T = void>(
  fn: (retryCount: number, attempt: number) => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const retries = options?.retries ?? 10
  const factor = options?.factor ?? 1
  const minTimeout = options?.minTimeout ?? 1000
  const maxTimeout = options?.maxTimeout ?? 30000

  const getDelay = (attempt: number): number => {
    if (options?.delay) {
      return options.delay(attempt)
    }
    if (factor <= 1) {
      return minTimeout
    }
    return Math.min(minTimeout * Math.pow(factor, Math.max(0, attempt - 1)), maxTimeout)
  }

  let lastError: Error

  return new Promise<T>((resolve, reject) => {
    let attempt = 0
    const next = async () => {
      try {
        const result = await fn(retries, attempt)
        resolve(result)
      } catch (error) {
        lastError = error as Error
        attempt++
        if (attempt > retries) {
          reject(lastError)
          return
        }
        setTimeout(next, getDelay(attempt))
      }
    }
    next()
  })
}

export interface TimeEndFunction {
  /**
   * @returns Elapsed milliseconds.
   */
  (): number

  /**
   * @returns Elapsed milliseconds rounded.
   */
  rounded(): number

  /**
   * @returns Elapsed seconds.
   */
  seconds(): number

  /**
   * @returns Elapsed nanoseconds.
   */
  nanoseconds(): bigint
}

/**
 * Returns a function that can be used to measure the time elapsed
 * since the function was called.
 */
export function timeSpan(): TimeEndFunction {
  const start = performance.now()

  const end = () => performance.now() - start
  end.rounded = () => Math.round(end())
  end.seconds = () => end() / 1000
  end.nanoseconds = () => end() * 1000000

  return end as unknown as TimeEndFunction
}
