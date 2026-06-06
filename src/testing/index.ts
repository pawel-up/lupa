/**
 * Core testing primitives for Lupa including DOM fixtures and testing helpers.
 *
 * @packageDocumentation
 * @module @pawel-up/lupa/testing
 */
// All modules from this folder are executed in the browser and can only use browser APIs.
export { test, fixture, html } from './api.js'
export { TestContext } from './test_context.js'
export { aTimeout, nextFrame, oneEvent, waitUntil, createFileDragEvent, type DragEventType } from './helpers.js'
