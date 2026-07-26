# Synthetic Events API (`events`)

The `events` API in Lupa provides synchronous, lightweight synthetic DOM event dispatching directly on target elements. It allows you to simulate keyboard, mouse, form input, clipboard, and focus interactions without incurring cross-process RPC network roundtrips.

---

## Importing `events`

Import the `events` factory function and `KeyCode` enum from `@pawel-up/lupa/commands`:

```typescript
import { events, KeyCode } from '@pawel-up/lupa/commands'
```

---

## Why Use Synthetic Events?

When running large test suites across multiple browsers (Chromium, Firefox, WebKit), Playwright's native IPC bridge can become saturated with WebSocket requests, leading to test timeouts. `events(target)` solves this by dispatching DOM events synchronously inside the browser context.

### Key Benefits
* **Lightning Performance**: Bypasses Playwright RPC network roundtrips and IPC queue latency entirely.
* **Synchronous Event Handlers**: DOM event listeners (`addEventListener`) execute immediately upon calling `events(target)`.
* **Zero IPC Flooding**: Enables running hundreds of component tests in parallel across all 3 browsers without timing out.
* **Rich Helper Namespaces**: Provides dedicated helpers for `keyboard`, `mouse`, `input`, `clipboard`, and `focus`.

---

## When to Use `events(target)` vs Native Playwright Commands

| Feature | `events(target)` (Synthetic Events) | Native Playwright Commands (`keyboard`, `mouse`, `locator`) |
| :--- | :--- | :--- |
| **Execution** | Synchronous inside DOM | Asynchronous over WebSocket RPC bridge |
| **Performance** | Instant (~0ms latency) | Has network / IPC RPC overhead |
| **Actionability Checks** | Bypasses visibility / occlusion checks | Automatically waits for element to be visible & enabled |
| **Best Use Case** | Unit tests, Web Components, isolated UI components, large parallel suites | E2E user flow tests, OS driver interactions, coordinate dragging |

### Summary Rules:
* **Use `events(target)` when**: You are testing isolated DOM components, web components, form inputs, keyboard shortcuts, or running large component test suites where execution speed and avoiding IPC flooding are critical.
* **Do NOT use `events(target)` (Use Native Commands) when**: You need Playwright's automatic actionability checks (verifying an element is visible, stable, and enabled before clicking), testing native browser OS input drivers, coordinate-based canvas clicks, or native file chooser dialogs.

---

## API Reference

### 1. Keyboard Events (`events(target).keyboard`)

Dispatches `keydown` and `keyup` `KeyboardEvent` instances directly on the target element.

#### `down(code, init?)` & `up(code, init?)`
Dispatches a single `keydown` or `keyup` event. Supports `KeyCode` enums, character strings, and Playwright-style modifier shortcuts.

```typescript
// Using KeyCode enum
events(input).keyboard.down(KeyCode.Enter)
events(input).keyboard.up(KeyCode.Enter)

// Using modifier shortcuts (Control, Meta, Shift, Alt, ControlOrMeta)
events(input).keyboard.down('ControlOrMeta+A')
```

#### `press(code, options?)`
Asynchronously dispatches `keydown` followed by `keyup`. Accepts an optional `{ delay: number }` in milliseconds.

```typescript
await events(input).keyboard.press('Control+A')
await events(input).keyboard.press(KeyCode.Backspace, { delay: 50 })
```

#### `type(text, options?)`
Sequentially presses each character in a text string. Accepts an optional `{ delay: number }` in milliseconds.

```typescript
await events(input).keyboard.type('Hello World', { delay: 30 })
```

---

### 2. Mouse Events (`events(target).mouse`)

Dispatches synthetic `MouseEvent` instances on target elements.

#### `click(options?)`
Dispatches `mousedown` → `mouseup` → `click` in sequence on the element.

```typescript
events(button).mouse.click()
```

#### `dblclick(options?)`
Dispatches double-click event sequence (`mousedown` → `mouseup` → `click` → `mousedown` → `mouseup` → `click` → `dblclick`).

```typescript
events(card).mouse.dblclick()
```

#### `contextMenu(options?)`
Dispatches a right-click `contextmenu` event (`button: 2`).

```typescript
events(menuItem).mouse.contextMenu()
```

#### `hover(options?)` & `leave(options?)`
Dispatches `mouseover`/`mouseenter` or `mouseout`/`mouseleave` event pairs.

```typescript
events(tooltipTarget).mouse.hover()
events(tooltipTarget).mouse.leave()
```

---

### 3. Input & Form Control Events (`events(target).input`)

In standard DOM testing, setting `input.value = 'text'` does not automatically trigger `input` or `change` listeners. `InputEvents` handles property mutation and event dispatching atomically.

#### `fill(value, options?)`
Sets `input.value = value`, then dispatches `input` (bubbles) and `change` (bubbles) events.

```typescript
events(input).input.fill('John Doe')
```

#### `check()`, `uncheck()`, & `toggle()`
Updates `.checked` state on checkbox or radio controls and dispatches `input` and `change` events.

```typescript
events(checkbox).input.check()
events(checkbox).input.uncheck()
events(checkbox).input.toggle()
```

#### `selectOption(value, options?)`
Sets value on `<select>` elements and dispatches a `change` event.

```typescript
events(selectEl).input.selectOption('option-2')
```

---

### 4. Clipboard Events (`events(target).clipboard`)

Dispatches `paste`, `copy`, and `cut` events populated with mock `DataTransfer` payload objects.

#### `paste(data, options?)`
Dispatches a synthetic `ClipboardEvent('paste')` populated with a `DataTransfer` object.

```typescript
// Paste string text
events(editor).clipboard.paste('Pasted Text')

// Paste multiple MIME types
events(editor).clipboard.paste({
  'text/plain': 'Plain text',
  'text/html': '<b>HTML text</b>'
})
```

#### `copy(data?, options?)` & `cut(data?, options?)`
Dispatches `copy` or `cut` events with optional `DataTransfer` payloads.

```typescript
events(editor).clipboard.copy('Copied Data')
events(editor).clipboard.cut('Cut Data')
```

---

### 5. Focus & Blur Events (`events(target).focus`)

Manages focus state and dispatches focus/blur event pairs while preventing duplicate event dispatching if native focus fires.

#### `in()` / `focus()`
Triggers native `.focus()` if available and dispatches `focus` and `focusin` events.

```typescript
events(input).focus.in()
// Or using alias
events(input).focus.focus()
```

#### `out()` / `blur()`
Triggers native `.blur()` if available and dispatches `blur` and `focusout` events.

```typescript
events(input).focus.out()
// Or using alias
events(input).focus.blur()
```
