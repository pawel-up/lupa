/**
 * Node-side registry tracking which file paths are mocked for a given test ID.
 * Consulted by the Vite plugin's load hook to decide whether to serve a synthetic module.
 */
class MockRegistry {
  #store = new Map<string, Set<string>>()

  register(testId: string, path: string): void {
    let paths = this.#store.get(testId)
    if (!paths) {
      paths = new Set()
      this.#store.set(testId, paths)
    }
    paths.add(path)
  }

  isRegistered(testId: string, path: string): boolean {
    return this.#store.get(testId)?.has(path) ?? false
  }

  clear(testId: string): void {
    this.#store.delete(testId)
  }
}

export const registry = new MockRegistry()
