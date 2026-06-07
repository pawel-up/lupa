# Mouse API

The `mouse` API in Lupa enables precise simulation of raw pointer inputs, coordinate-based clicks, dragging gestures, and custom cursor paths page-wide.

---

## The Mouse Singleton

To interact with the mouse, import the pre-instantiated `mouse` singleton:

```ts
import { mouse } from '@pawel-up/lupa/commands'
```

## Mouse Actions

All mouse actions are asynchronous and return a promise.

### Cursor Movement

* **`setPosition(point)`**: Sets the mouse cursor to a specific coordinate `(x, y)` on the page immediately, without triggering intermediate mouse movement events.
  ```ts
  await mouse.setPosition({ x: 100, y: 150 })
  ```

* **`move(point, options?)`**: Moves the mouse cursor to a target coordinate `(x, y)`. Unlike `setPosition`, `move` simulates a physical mouse path and fires intermediate mouse movement events.
  ```ts
  // Move to (300, 200)
  await mouse.move({ x: 300, y: 200 })

  // Move in steps to control speed/granularity
  await mouse.move({ x: 300, y: 200 }, { steps: 5 })
  ```

### Clicks and Gestures

* **`click(point, options?)`**: Performs a click at the specified `(x, y)` coordinate.
  ```ts
  await mouse.click({ x: 150, y: 200 })

  // Right-click or middle-click
  await mouse.click({ x: 150, y: 200 }, { button: 'right' })
  ```

* **`dblclick(point, options?)`**: Performs a double-click at the specified coordinate.
  ```ts
  await mouse.dblclick({ x: 150, y: 200 })
  ```

### Pressing & Drag-and-Drop

* **`down(options?)` / `up(options?)`**: Simulates pressing down or releasing a mouse button.
  ```ts
  // Drag-and-drop workflow:
  await mouse.move({ x: 100, y: 100 })
  await mouse.down({ button: 'left' })
  await mouse.move({ x: 400, y: 400 })
  await mouse.up({ button: 'left' })
  ```

* **`press(point, options?)`**: Focuses a coordinate, holds the button, and simulates key modifiers during the mouse click event.
  ```ts
  // Click while holding Shift
  await mouse.press({ x: 200, y: 200 }, { button: 'left', key: 'Shift' })
  ```

### Resetting Mouse State

* **`reset()`**: Resets the cursor position to `(0, 0)` and releases any active mouse buttons (such as held-down left/right/middle buttons).
  ```ts
  await mouse.reset()
  ```

## State Preservation and Safety

> [!CAUTION]
> **Persistent State**: The mouse retains its state (position and active button presses) across commands. If you call `mouse.down({ button: 'left' })`, the left button will remain pressed and affect subsequent mouse interactions.
> 
> Always call `await mouse.reset()` in your test `teardown` or in `afterEach` hooks if your tests simulate button presses.

```ts
import { test } from '@pawel-up/lupa'
import { mouse } from '@pawel-up/lupa/commands'

test.group('Drawing Canvas', (group) => {
  group.teardown(async () => {
    // Safely reset mouse status for the next test
    await mouse.reset()
  })

  test('should draw on canvas', async ({ assert }) => {
    await mouse.setPosition({ x: 50, y: 50 })
    await mouse.down()
    await mouse.move({ x: 200, y: 50 }, { steps: 10 })
    await mouse.up()
    
    // assert drawing result...
  })
})
```

## Deprecation Notice

> [!WARNING]
> The legacy `sendMouse(payload)` and `resetMouse()` helper functions are deprecated and will be removed:
> ```ts
> // DEPRECATED
> await sendMouse({ type: 'move', position: [100, 100] })
> await resetMouse()
> ```
> Please transition your tests to the class-based `mouse` API:
> ```ts
> // RECOMMENDED
> await mouse.move({ x: 100, y: 100 })
> await mouse.reset()
> ```

## Best Practices (Dos and Don'ts)

### Dos
- **Do** use `locator.dragTo()` or standard locator actions whenever possible. Raw coordinates can be fragile and break if the page layout changes.
- **Do** call `mouse.reset()` inside group/test teardown blocks to isolate mouse states between tests.

### Don'ts
- **Don't** assume the mouse pointer starts at a specific element. Use `locator.getBoundingClientRect()` or `locator.hover()` to align the mouse position with a target element before triggering clicks.
