# Keyboard API

The `keyboard` API in Lupa allows you to interact with the keyboard page-wide, rather than targeting a specific locator. It simulates raw hardware keystrokes and text inputs directly in the browser context.

---

## The Keyboard Singleton

To use the Keyboard API, import the pre-instantiated `keyboard` singleton:

```ts
import { keyboard } from '@pawel-up/lupa/commands'
```

---

## Keyboard Actions

All keyboard actions are asynchronous and must be `await`ed.

### Typing Text

* **`type(text, options?)`**: Types a string of characters key-by-key into the currently focused element. This fires `keydown`, `keypress`, and `keyup` events for each character.
  ```ts
  await keyboard.type('Hello World!')
  ```
  *Note: You can pass a `delay` option (in milliseconds) to control typing speed:*
  ```ts
  await keyboard.type('Username', { delay: 50 })
  ```

* **`insertText(text)`**: Inserts a block of text into the focused input element immediately without dispatching individual keystroke events. This is useful for pasting or filling text rapidly.
  ```ts
  await keyboard.insertText('A large block of pasted text...')
  ```

### Simulating Physical Keys

* **`down(key)`**: Simulates pressing a key down. The key remains held down until you call `keyboard.up(key)`.
  ```ts
  // Hold Shift key
  await keyboard.down('Shift')
  ```
* **`up(key)`**: Simulates releasing a key.
  ```ts
  // Release Shift key
  await keyboard.up('Shift')
  ```

* **`press(key, options?)`**: Simulates pressing a key down and releasing it immediately (a complete keystroke).
  ```ts
  await keyboard.press('Backspace')
  
  // Pressing combinations with modifiers
  await keyboard.press('Control+A')
  await keyboard.press('Shift+ArrowLeft')
  ```
  *Note: You can pass a `delay` option to simulate a key held down for a duration:*
  ```ts
  await keyboard.press('ArrowDown', { delay: 100 })
  ```

---

## Modifier Keys and Virtual Keys

The Keyboard API accepts standard virtual key names used by Playwright. Some common keys:
- Modifiers: `Control`, `Alt`, `Shift`, `Meta` (Windows key / Command key)
- Navigation: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `PageUp`, `PageDown`
- Control: `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`, `Space`
- Function: `F1` through `F12`

For a complete list of valid key names, refer to the [Keyboard Key Codes](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values) reference.

---

## Deprecation Notice

> [!WARNING]
> The legacy `sendKeys(payload)` utility function has been deprecated and will be removed in a future release:
> ```ts
> // DEPRECATED
> await sendKeys({ type: 'Hello' })
> await sendKeys({ press: 'Enter' })
> ```
> Please transition your tests to use the class-based `keyboard` singleton:
> ```ts
> // RECOMMENDED
> await keyboard.type('Hello')
> await keyboard.press('Enter')
> ```

---

## Best Practices (Dos and Don'ts)

### Dos
- **Do** ensure that an input element is actively focused before calling `keyboard.type()` or `keyboard.press()`. You can focus an element using a locator's `click()` or by calling `focus()` programmatically.
- **Do** clean up held keys. If you call `keyboard.down('Shift')`, ensure you call `keyboard.up('Shift')` before the test finishes to prevent keys from remaining pressed in subsequent tests.
- **Do** use `keyboard.insertText()` instead of `keyboard.type()` for very long inputs when individual keypress event simulation is not required.

### Don'ts
- **Don't** use `keyboard.type()` as a replacement for `locator.fill()`. `locator.fill()` is faster and more reliable because it automatically selects the input, clears it, and inputs the text in one step. Use `keyboard` only when you need to simulate specific, hardware-level physical typing (e.g. testing keyboard shortcuts).
