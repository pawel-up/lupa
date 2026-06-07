# Screenshot API

The `screenshot` API in Lupa allows you to capture visual snapshots of the active browser page or specific elements and save them directly to the local filesystem.

---

## The Screenshot Singleton

Import the pre-instantiated `screenshot` singleton to capture page-wide or element-specific screenshots:

```ts
import { screenshot } from '@pawel-up/lupa/commands'
```

## Capturing Screenshots

All screenshot actions are asynchronous and require a **mandatory** `path` parameter.

### Page-Level Screenshots

* **`take(options)`**: Captures the visible viewport (or the entire page layout) and saves it to a file.
  ```ts
  // Capture the visible viewport
  await screenshot.take({ path: 'screenshots/dashboard-view.png' })

  // Capture the full scrollable page
  await screenshot.take({
    path: 'screenshots/dashboard-full.png',
    fullPage: true
  })
  ```

### Element-Level Screenshots

* **`takeOf(query, options)`**: Captures a visual snapshot of a specific element resolved by a query.
  ```ts
  await screenshot.takeOf(
    { css: '#product-chart' },
    { path: 'screenshots/product-chart.png' }
  );
  ```

## Locator Screenshot Helper

As an alternative to `screenshot.takeOf()`, you can call `screenshot()` directly on a Lupa `Locator`:

```ts
import { query } from '@pawel-up/lupa/commands'

const chart = query({ css: '#product-chart' })

// Capture screenshot directly from the locator
await chart.screenshot({ path: 'screenshots/locator-chart.png' })
```

## Parameters Reference

### PageScreenshotOptions
* **`path`** *(string, required)*: The absolute or relative file path where the screenshot will be saved.
* **`fullPage`** *(boolean, optional)*: When set to `true`, captures the full scrollable document height instead of just the currently visible viewport.
* **`quality`** *(number, optional)*: The quality of the image, between 0-100. (Only applicable for `jpeg` or `webp` types).
* **`type`** *('png' | 'jpeg' | 'webp', optional)*: The image file format. Defaults to `png`.

## Best Practices (Dos and Don'ts)

### Dos
- **Do** create target directories beforehand or let Lupa resolve them relative to the root project workspace directory.
- **Do** use `fullPage: true` if you want to inspect a long, scrollable report or form layout.

### Don'ts
- **Don't** forget to provide the `path` argument. If `path` is omitted, Lupa will immediately reject the promise and throw a validation error:
  ```ts
  // ERROR: Path option is required
  await screenshot.take()
  ```
- **Don't** use page-level screenshots to assert component styling. Use element-level screenshots (`locator.screenshot()` or `screenshot.takeOf()`) to focus only on the relevant element and avoid test flakiness due to dynamic page headers/footers.
