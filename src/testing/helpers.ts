/**
 * Returns a promise that resolves after the specified number of milliseconds.
 * @param ms - Number of milliseconds to wait
 * @returns Promise that resolves after the specified number of milliseconds
 * @example
 * ```typescript
 * await aTimeout(1000)
 * ```
 */
export function aTimeout(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Returns a promise that resolves after the next browser animation frame.
 * @returns Promise that resolves after the next browser animation frame
 * @example
 * ```typescript
 * await nextFrame()
 * ```
 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/**
 * Returns a promise that resolves when the specified event is dispatched on the element.
 * @template T - Type of the event detail, only relevant for CustomEvents
 * @template E - Type of the event, defaults to CustomEvent<T>
 * @param eventTarget - Target of the event, usually an EventTarget
 * @param eventName - Name of the event to wait for
 * @returns Promise that resolves when the specified event is dispatched on the element
 * @example
 * ```typescript
 * const event = await oneEvent(element, 'click')
 * assert.strictEqual(event.type, 'click')
 * ```
 */
export function oneEvent<T = any, E extends Event = CustomEvent<T>>(
  element: EventTarget,
  eventName: string
): Promise<E> {
  return new Promise((resolve) => {
    const listener = (event: E) => {
      element.removeEventListener(eventName, listener as EventListener)
      resolve(event)
    }
    element.addEventListener(eventName, listener as EventListener)
  })
}

/**
 * Polls the condition function until it returns true or the timeout is reached.
 *
 * @remarks
 * If the condition function throws an error, the error is suppressed and the polling
 * continues until the condition returns true or the timeout expires. The `interval`
 * option determines the delay between polling attempts (default is 50ms), and the
 * `timeout` option determines the maximum total duration before the promise rejects
 * with the provided `message` (default is 1000ms).
 *
 * @param condition - Function to poll
 * @param message - Message to use when throwing an error
 * @param options - Options for waitUntil
 * @returns Promise that resolves when the condition is met
 * @example
 * ```typescript
 * await waitUntil(() => element.textContent === 'Hello')
 * ```
 */
export async function waitUntil(
  condition: () => boolean | Promise<boolean>,
  message = 'waitUntil timed out',
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { interval = 50, timeout = 1000 } = options
  const startTime = Date.now()

  // Save the current stack so that we can reference it later if we timeout.
  const { stack } = new Error()

  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        if (await condition()) {
          resolve()
          return
        }
      } catch {
        // Ignore errors during evaluation, keep polling
      }

      if (Date.now() - startTime >= timeout) {
        const error = new Error(message ? `Timeout: ${message}` : `waitUntil timed out after ${timeout}ms`)
        error.stack = stack
        reject(error)
        return
      }

      setTimeout(check, interval)
    }

    check()
  })
}

/**
 * Listens for one event, calls `event.preventDefault()` and resolves with this event object after it was fired.
 *
 * @example
 * ```typescript
 * const form = document.querySelector('form')
 * form.querySelector('button[type="submit"]).click()
 * const event = await oneDefaultPreventedEvent(form, 'submit')
 * assert.isTrue(event.defaultPrevented)
 * ```
 * @template T - Type of the event detail, only relevant for CustomEvents
 * @template E - Type of the event, defaults to CustomEvent<T>
 * @param eventTarget Target of the event, usually an Element
 * @param eventName Name of the event
 * @returns Promise to await until the event has been fired
 */
export function oneDefaultPreventedEvent<T = any, E extends Event = CustomEvent<T>>(
  eventTarget: EventTarget,
  eventName: string
): Promise<E> {
  return new Promise((resolve) => {
    function listener(ev: E) {
      ev.preventDefault()
      resolve(ev)
      eventTarget.removeEventListener(eventName, listener as EventListener)
    }
    eventTarget.addEventListener(eventName, listener as EventListener)
  })
}
