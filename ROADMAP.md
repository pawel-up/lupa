# Lupa Roadmap 🚀

This document outlines the planned features, enhancements, and long-term vision for the Lupa testing framework.

## 📌 Near-Term Priorities

### 1. Expanded DOM Assertions
While we have a solid base with Chai, we need a robust, web-component specific assertion library.
- ~~**Semantic Equality:** `assert.dom.equal(el, '<my-element>...</my-element>')` (ignoring whitespace/attribute order).~~
- ~~**Light/Shadow DOM targeting:** `assert.shadowDom.equal(el, '...')`.~~
- ~~**Style assertions:** `assert.dom.hasStyle(el, 'color', 'red')`.~~

~~### 2. Coverage Reporting~~
~~Native support for test coverage.~~
~~- Instrument code via Vite (e.g., using `vite-plugin-istanbul` or `v8` coverage).~~
~~- Extract `window.__coverage__` via the Playwright telemetry bridge.~~
~~- Map coverage back to original TypeScript sources and generate standard `lcov`/`html` reports.~~

~~### 3. Parallel Execution & Cross-Browser Matrix~~
~~Scale test execution speed and browser matrix.~~
~~- **Parallel Workers:** Run suites concurrently across multiple Playwright browser contexts.~~
~~- **Multi-Browser Runs:** Configure Lupa to run the same suite against Chromium, Firefox, and WebKit simultaneously.~~

~~### 4. AI Coding Agent Skills (`SKILL.md`)~~
~~Create standard instructions for AI coding assistants.~~
~~- Document exactly how an AI agent should write tests using the Lupa framework.~~
~~- Create a `.agents/skills/lupa-testing/SKILL.md` file that teaches agents how to mount `fixture()`s, use DOM assertions, and follow best practices.~~

---

## 🔮 Future Enhancements & Ideas

### 4. VSCode IDE Extension
Bring Lupa directly into the developer's workspace.
- **Test Explorer UI:** Discover, run, and debug specific tests directly from the VSCode sidebar.
- **Gutter Icons:** Clickable play/debug buttons next to `test()` blocks.
- **Inline Errors:** Display test failure messages and stack traces inline within the editor.

### 5. Network & Module Mocking
Provide out-of-the-box mocking ergonomics.
- **Network Interception:** Simple API to mock `fetch` or XHR requests using Playwright's native `page.route()`, directly from the test context (`test('...', ({ mockNetwork }) => { ... })`).
- **Module Mocking:** High-level APIs to mock ES modules in the Vite module graph without complex configuration.

### 6. Visual Regression (Snapshot) Testing
Visual validation for web components.
- **DOM Snapshots:** Serialize DOM states and compare against baseline files (similar to Jest snapshots).
- **Image Snapshots:** Utilize Playwright's `expect(page).toHaveScreenshot()` to catch visual CSS regressions.

### 7. Performance & Interaction Testing
Go beyond functional correctness.
- **Interaction Macros:** Built-in macros for common interactions (`await user.type(input, 'Hello')`, `await user.swipe()`).
- **Render Performance:** Assertions to verify a component renders within a certain millisecond threshold using the Performance API.
- **Mobile Emulation:** Easily test responsive components by overriding viewport sizes and device pixel ratios per-test.

### 8. Benchmarking Integration
Native support for running benchmarks, recording results, and analyzing them for performance regressions by deeply integrating the `@pawel-up/benchmark` library directly into the runner.

---

## 🌌 Visionary & Far-Reaching Ideas

### 9. Lupa Component Explorer (Storybook Alternative)
Since Lupa already mounts your components in isolation and uses Vite, it could easily serve double-duty as a component sandbox.
- Render all `fixture()` calls visually in a dedicated UI.
- Allow users to interact with components, change properties, and see live updates without maintaining a separate Storybook/Ladle configuration.

### 10. Time Travel Debugging & Tracing
Integrate deeply with Playwright's Trace Viewer (or tools like Replay.io).
- On failure, automatically generate a time-travel trace.
- Allow developers to step *backwards* through the DOM mutations, network requests, and console logs leading up to the assertion failure.

### 11. AI-Assisted Test Healing
Leverage LLMs to fix brittle tests.
- **Auto-Healing:** If a DOM selector breaks because a class name changed, Lupa could intelligently suggest the new selector.

### 12. Property-Based Fuzz Testing
Automatically discover edge cases in your components.
- Feed random, unexpected data types into component properties/attributes and rapidly trigger random lifecycle events to search for memory leaks or unhandled DOM exceptions.
