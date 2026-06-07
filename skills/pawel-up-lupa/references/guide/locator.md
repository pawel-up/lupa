# Locator API

Locators are the core mechanism for finding and interacting with elements in Lupa. They are created using the `query()` function, which supports a wide range of semantic and standard selectors.

The Locator API in Lupa is heavily inspired by Playwright's Locator API, optimized specifically for writing readable browser-based tests.

---

## Creating Locators

To select an element, import `query` and pass a query object:

```ts
import { query } from '@pawel-up/lupa/commands'

// Creating a locator
const button = query({ role: 'button' })
```

---

## Supported Selectors

Lupa encourages the use of **semantic queries** matching user-facing behavior rather than implementation details (like classes or internal IDs).

### Semantic Selectors

* **`role`**: Matches elements by their ARIA role (e.g., `'button'`, `'textbox'`, `'heading'`, `'link'`).
  ```ts
  await query({ role: 'button' }).click()
  ```
* **`text`**: Matches elements containing the specified text.
  ```ts
  await query({ text: 'Submit Form' }).click()
  ```
* **`label`**: Matches form control elements (inputs, select dropdowns) by their associated `<label>` text.
  ```ts
  await query({ label: 'Username' }).fill('admin')
  ```
* **`placeholder`**: Matches inputs by their `placeholder` attribute.
  ```ts
  await query({ placeholder: 'Search products...' }).fill('laptop')
  ```
* **`altText`**: Matches elements (such as `<img>`) by their `alt` text attribute.
  ```ts
  await query({ altText: 'Company Logo' }).click()
  ```
* **`title`**: Matches elements by their `title` attribute.
  ```ts
  await query({ title: 'Close dialog' }).click()
  ```
* **`testId`**: Matches elements by their `data-testid` attribute (useful when semantic selectors are not applicable).
  ```ts
  await query({ testId: 'submit-button' }).click()
  ```

### Standard Selectors

When semantic query options do not suffice, you can fall back to standard selectors:

* **`css`**: Matches elements via standard CSS selectors.
  ```ts
  await query({ css: '#main-content .header' }).hover()
  ```
* **`xpath`**: Matches elements via XPath queries.
  ```ts
  await query({ xpath: '//div[@id="root"]//p' }).click()
  ```

---

## Locator Actions

All actions on a locator are **asynchronous** and return a promise. They automatically wait for the targeted element to become visible and interactive before performing the action.

### General Interactions

* **`click(options?)`**: Clicks the element.
* **`dblclick(options?)`**: Double-clicks the element.
* **`hover(options?)`**: Moves the mouse pointer over the element.
* **`press(key, options?)`**: Focuses the element and presses a specific key (e.g., `'Enter'`, `'Control+A'`).
* **`tap(options?)`**: Simulates a touch tap on mobile layouts.
* **`blur(options?)`**: Blurs the focused element.

### Form Interactions

* **`fill(text, options?)`**: Fills an `<input>`, `<textarea>`, or `[contenteditable]` element.
  ```ts
  await query({ label: 'Name' }).fill('Jane Doe')
  ```
* **`clear(options?)`**: Clears the input field.
  ```ts
  await query({ label: 'Name' }).clear()
  ```
* **`check(options?)` / `uncheck(options?)`**: Checks or unchecks a checkbox or radio button.
  ```ts
  await query({ role: 'checkbox' }).check()
  ```
* **`pressSequentially(text, options?)`**: Types text into the element character-by-character, simulating real typing speed. You can configure a `delay` between keystrokes.
  ```ts
  await query({ role: 'textbox' }).pressSequentially('Slow typing...', { delay: 100 })
  ```
* **`selectOption(values, options?)`**: Selects one or more options in a `<select>` dropdown. You can select by value, label, or index.
  ```ts
  // Select by value
  await query({ role: 'combobox' }).selectOption('green')

  // Select multiple values
  await query({ role: 'listbox' }).selectOption(['red', 'blue'])
  ```

### File Interactions

* **`setInputFiles(files, options?)`**: Uploads one or more files directly to a file input element (`<input type="file">`). Files are resolved relative to the test runner's current working directory.
  ```ts
  // Single file upload
  await query({ css: 'input[type=file]' }).setInputFiles('tests/fixtures/document.pdf')

  // Multiple files upload
  await query({ css: 'input[type=file]' }).setInputFiles([
    'tests/fixtures/photo1.jpg',
    'tests/fixtures/photo2.jpg'
  ])
  ```

### Drag and Drop

The `dragTo` method allows you to perform drag-and-drop operations between elements. Lupa automatically moves the mouse to the source element, presses the mouse button, moves to the target element, and releases the mouse button.

* **`dragTo(target, options?)`**: Drags the locator's element to the specified `target` (which can be a locator object or a query).

```ts
import { query } from '@pawel-up/lupa/commands'

const item = query({ testId: 'draggable-item' })
const bin = query({ testId: 'trash-bin' })

// Drag item and drop it into bin
await item.dragTo(bin)
```

#### Custom Positions

By default, Lupa drags from a visible point on the source element to a visible point on the target element. You can specify exact relative coordinates (relative to the top-left corner of the element's padding box) using `sourcePosition` and `targetPosition`:

```ts
await item.dragTo(bin, {
  sourcePosition: { x: 10, y: 10 },
  targetPosition: { x: 50, y: 50 }
})
```

### Capturing Screenshots

* **`screenshot(options)`**: Captures a visual snapshot of the specific element and saves it to a file. The `path` option is **mandatory**.
  ```ts
  await query({ css: '.chart-card' }).screenshot({ path: 'element-chart.png' })
  ```

---

## Best Practices (Dos and Don'ts)

### Dos
- **Do** prefer semantic selectors (like `role`, `label`, `text`) over CSS classes or IDs. This makes your tests resilient to layout changes and verifies accessibility characteristics.
- **Do** `await` every locator action. Since Lupa commands are executed asynchronously via RPC to the browser runner, failing to await them causes race conditions.
- **Do** use `pressSequentially` when testing autocomplete search boxes or text fields that trigger dynamic API searches on keypress events.

### Don'ts
- **Don't** chain queries blindly (e.g., `query({ css: '.container' }).query({ css: 'button' })`). Instead, write descriptive queries directly or use specific role matches.
- **Don't** use `click()` or `fill()` on elements that are hidden or disabled. Lupa will throw an error or time out since the element is not interactive.
- **Don't** hardcode timeouts in tests if an action fails. Rely on Lupa's automatic waiting and assertions.
