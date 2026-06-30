/* eslint-disable no-console */
import { html, render, svg } from 'lit-html'
import type { Emitter } from './emitter.js'
import type { BrowserTelemetryEvents, RunnerEndNode } from '../types.js'

/**
 * A built-in reporter for the browser environment that visually
 * outputs test results into the browser DevTools console
 * when running tests in debug mode, and overlays a visual summary.
 */
export class BrowserReporter {
  #state = {
    passed: 0,
    failed: 0,
    skipped: 0,
    todo: 0,
  }

  boot(emitter: Emitter<BrowserTelemetryEvents>) {
    emitter.on('runner:start', () => {
      this.#state = { passed: 0, failed: 0, skipped: 0, todo: 0 }
      this.#clearUI()
    })

    emitter.on('suite:start', (payload) => {
      console.group(`%cSuite: ${payload.name}`, 'font-weight: bold')
    })

    emitter.on('suite:end', () => {
      console.groupEnd()
    })

    emitter.on('group:start', (payload) => {
      console.group(`%cGroup: ${payload.title}`, 'font-weight: bold')
    })

    emitter.on('group:end', () => {
      console.groupEnd()
    })

    emitter.on('test:end', (payload) => {
      if (payload.hasError) {
        this.#state.failed++
        console.group(`%c✖ ${payload.title.expanded}`, 'color: #D32F2F')
        if (payload.errors && payload.errors.length) {
          payload.errors.forEach(({ error }) => {
            console.error(error)
          })
        }
        console.groupEnd()
      } else if (payload.isSkipped || payload.isTodo) {
        if (payload.isSkipped) this.#state.skipped++
        if (payload.isTodo) this.#state.todo++
        console.log(`%c⏸ ${payload.title.expanded}`, 'color: #3d4149')
      } else {
        this.#state.passed++
        console.log(`%c✔ ${payload.title.expanded}`, 'color: #1B5E20')
      }
    })

    emitter.on('runner:import_error', (payload) => {
      console.group(`%c✖ Import Error: ${payload.file}`, 'color: #D32F2F; font-weight: bold')
      console.error(payload.error)
      console.groupEnd()
    })

    emitter.on('uncaught:exception', (payload) => {
      console.group(`%c✖ Uncaught Exception`, 'color: #D32F2F; font-weight: bold')
      console.error(payload.error)
      console.groupEnd()
    })

    emitter.on('runner:end', (payload) => {
      this.#renderUI(payload)
    })
  }

  #clearUI() {
    const existingUi = document.getElementById('lupa-browser-ui')
    if (existingUi) {
      render(html``, existingUi)
      existingUi.remove()
    }
    document.body.style.backgroundColor = ''
    document.body.style.margin = ''
  }

  #getLogoSVG() {
    return svg`<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clip-path="url(#clip0_1_8)">
        <path d="M128 0H0V128H128V0Z" fill="#1A2233" />
        <path
          d="M32 25.6C32 22.0654 34.8654 19.2 38.4 19.2C41.9346 19.2 44.8 22.0654 44.8 25.6V96H89.6C93.1346 96 96 98.8654 96 102.4C96 105.935 93.1346 108.8 89.6 108.8H38.4C34.8654 108.8 32 105.935 32 102.4V25.6Z"
          fill="url(#paint0_linear_1_8)"
        />
        <path
          d="M85.76 57.6C85.76 49.1169 78.8831 42.24 70.4 42.24C61.9169 42.24 55.04 49.1169 55.04 57.6C55.04 66.0831 61.9169 72.96 70.4 72.96C78.8831 72.96 85.76 66.0831 85.76 57.6ZM93.44 57.6C93.44 70.3246 83.1246 80.64 70.4 80.64C57.6754 80.64 47.36 70.3246 47.36 57.6C47.36 44.8754 57.6754 34.56 70.4 34.56C83.1246 34.56 93.44 44.8754 93.44 57.6Z"
          fill="url(#paint1_linear_1_8)"
        />
        <path
          d="M80.485 67.685C81.9846 66.1854 84.4154 66.1854 85.915 67.685L105.115 86.885C106.615 88.3846 106.615 90.8154 105.115 92.315C103.615 93.8146 101.185 93.8146 99.685 92.315L80.485 73.115C78.9854 71.6154 78.9854 69.1846 80.485 67.685Z"
          fill="url(#paint2_linear_1_8)"
        />
      </g>
      <defs>
        <linearGradient
          id="paint0_linear_1_8"
          x1="38.4"
          y1="25.6"
          x2="109.292"
          y2="72.8615"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="#0047AB" />
          <stop offset="1" stop-color="#00FFFF" />
        </linearGradient>
        <linearGradient id="paint1_linear_1_8" x1="51.2" y1="38.4" x2="89.6" y2="76.8" gradientUnits="userSpaceOnUse">
          <stop stop-color="#00FFFF" />
          <stop offset="1" stop-color="#0047AB" />
        </linearGradient>
        <linearGradient id="paint2_linear_1_8" x1="83.2" y1="70.4" x2="102.4" y2="89.6" gradientUnits="userSpaceOnUse">
          <stop stop-color="#00FFFF" />
          <stop offset="1" stop-color="#0047AB" />
        </linearGradient>
        <clipPath id="clip0_1_8">
          <rect width="128" height="128" rx="12" fill="white" />
        </clipPath>
      </defs>
    </svg>`
  }

  #renderTable() {
    return html`
      <table
        style="border-collapse: collapse; background-color: rgba(255, 255, 255, 0.1); border-radius: 0.5rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"
      >
        <tbody style="font-size: 1.25rem;">
          <tr>
            <td style="padding: 1rem 2rem; border-bottom: 1px solid rgba(0,0,0,0.1);">Passed</td>
            <td style="padding: 1rem 2rem; border-bottom: 1px solid rgba(0,0,0,0.1); font-weight: bold;">
              ${this.#state.passed}
            </td>
          </tr>
          <tr>
            <td style="padding: 1rem 2rem; border-bottom: 1px solid rgba(0,0,0,0.1);">Failed</td>
            <td style="padding: 1rem 2rem; border-bottom: 1px solid rgba(0,0,0,0.1); font-weight: bold;">
              ${this.#state.failed}
            </td>
          </tr>
          <tr>
            <td style="padding: 1rem 2rem; border-bottom: 1px solid rgba(0,0,0,0.1);">Skipped</td>
            <td style="padding: 1rem 2rem; border-bottom: 1px solid rgba(0,0,0,0.1); font-weight: bold;">
              ${this.#state.skipped}
            </td>
          </tr>
          <tr>
            <td style="padding: 1rem 2rem;">Todo</td>
            <td style="padding: 1rem 2rem; font-weight: bold;">${this.#state.todo}</td>
          </tr>
        </tbody>
      </table>
    `
  }

  #renderUI(payload: RunnerEndNode) {
    document.body.style.margin = '0'
    let ui = document.getElementById('lupa-browser-ui')
    if (!ui) {
      ui = document.createElement('div')
      ui.id = 'lupa-browser-ui'
      document.body.appendChild(ui)
    }

    // Add keyframes if not exists
    if (!document.getElementById('lupa-animations')) {
      const style = document.createElement('style')
      style.id = 'lupa-animations'
      style.innerHTML = `
        @keyframes lupa-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `
      document.head.appendChild(style)
    }

    const template = html`
      <div
        id="lupa-browser-overlay"
        style="position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; color: ${
          payload.hasError ? '#fff' : '#1f2937'
        }; background-color: ${
          payload.hasError ? '#ef4444' : '#f3f4f6'
        }; transition: opacity 0.5s ease-in-out; opacity: 0;"
      >
        <div
          style="margin-bottom: 2rem; animation: ${payload.hasError ? 'none' : 'lupa-bounce 2s infinite ease-in-out'};"
        >
          ${this.#getLogoSVG()}
        </div>
        <h1 style="font-size: 3rem; margin-bottom: 2rem;">
          ${payload.hasError ? 'Tests Failed' : 'All Tests Passed!'}
        </h1>
        <div>${this.#renderTable()}</div>
        ${
          payload.hasError
            ? html`<p style="margin-top: 2rem; opacity: 0.8;">Check the DevTools console for error details.</p>`
            : ''
        }
      </div>
    `

    render(template, ui)

    // Trigger fade in
    requestAnimationFrame(() => {
      const overlay = document.getElementById('lupa-browser-overlay')
      if (overlay) overlay.style.opacity = '1'
    })
  }
}
