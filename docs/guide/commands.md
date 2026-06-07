# Browser Commands Overview

Lupa provides a powerful set of APIs to interact with the browser and DOM elements natively during your tests. These APIs are exported from the `@pawel-up/lupa/commands` module.

All browser commands are fully typed and use a secure cross-process RPC bridge to communicate between your test context (running inside the Vite development server) and the underlying Playwright runner.

---

## How It Works

When you invoke a Lupa command in your test code, Lupa serializes the call and sends it via WebSocket to the Node.js runner. The runner executes the action natively using the Playwright API and returns the response:

```
+-----------------------------------+          WebSocket          +-----------------------------------+
|            Vite Browser           |  ========================>  |          Node.js Runner           |
| (Your Test & Lupa Client Command) |  <========================  | (Playwright Browser / RPC Server) |
+-----------------------------------+            RPC              +-----------------------------------+
```

Because of this RPC bridge:
- **All commands are asynchronous** and return promises that must be `await`ed.
- DOM elements can be manipulated safely without having to deal with cross-origin or security constraints.
- Native keyboard, mouse, cookie, screenshot, and file uploads are simulated perfectly.

---

## Command APIs

Lupa provides the following specialized APIs to manage your browser testing environment:

### [Locator API](./locator.md)
Allows you to select DOM elements using semantic or standard queries and interact with them. It automatically waits for elements to be visible, enabled, and interactive.
* *Actions*: `click()`, `fill()`, `check()`, `uncheck()`, `selectOption()`, `setInputFiles()`, `screenshot()`.

### [Keyboard API](./keyboard.md)
Simulates low-level physical keystrokes, shortcuts, and text typing page-wide.
* *Actions*: `keyboard.press()`, `keyboard.type()`, `keyboard.down()`, `keyboard.up()`, `keyboard.insertText()`.

### [Mouse API](./mouse.md)
Enables raw pointer inputs, coordinates-based dragging/clicking, and custom cursor paths.
* *Actions*: `mouse.move()`, `mouse.click()`, `mouse.down()`, `mouse.up()`, `mouse.reset()`.

### [Cookies API](./cookies.md)
Allows reading, writing, and clearing cookies in the active browser context. Ideal for authentication seed tests.
* *Actions*: `cookies.add()`, `cookies.getAll()`, `cookies.clear()`.

### [FileChooser Interception](./file-chooser.md)
Intercepts native browser file upload dialogs to assign files programmatically during tests.
* *Actions*: `fileChooser.waitForEvent()`, `fileChooser.setFiles()`.

### [Emulation API](./emulation.md)
Customizes browser environment features, including viewport sizing, media color schemes (dark mode/print), geo-locations, API permissions, and offline mode.
* *Actions*: `emulation.setViewport()`, `emulation.emulateMedia()`, `emulation.setGeolocation()`, `emulation.grantPermissions()`, `emulation.setOffline()`.

### [Screenshot API](./screenshot.md)
Captures page-wide or element-specific screenshots and writes them directly to your workspace filesystem.
* *Actions*: `screenshot.take()`, `screenshot.takeOf()`.
