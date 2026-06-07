# FileChooser Interception

When an application triggers a file upload, it often prompts the user with a native operating system file chooser dialog. Since tests run in a headless browser context, these native dialogs cannot be interacted with directly. 

Lupa provides the `fileChooser` API to intercept these native file dialogs and supply files programmatically.

## Direct Upload vs. FileChooser Interception

Lupa offers two ways to test file uploads:

1. **Direct Upload (`locator.setInputFiles`)**: Directly targets the underlying `<input type="file">` element. This does not trigger any dialog events.
   - *When to use*: This is the simplest and fastest method, and should be your default choice if the `<input type="file">` element is accessible in the DOM.
2. **FileChooser Interception (`fileChooser`)**: Listens for the browser's native file chooser dialog event, intercepts it, and assigns files.
   - *When to use*: Essential when clicking custom styled buttons, icons, or drag-and-drop elements triggers a native file chooser dialog, and you want to test the full event loop.

## Intercepting File Choosers

To intercept a file chooser event, import the `fileChooser` singleton:

```ts
import { fileChooser, query } from '@pawel-up/lupa/commands'
```

### The Synchronization Pattern

> [!IMPORTANT]
> **Event Loop Synchronization**: You must start waiting for the file chooser event *before* you click the button that triggers it. If you trigger the click first, the dialog will fire, and by the time you `await fileChooser.waitForEvent()`, the event will have already been missed, leading to a test timeout.
>
> Use `Promise.all` to trigger the click and wait for the event concurrently:

```ts
// 1. Wait for the chooser event and click the trigger element concurrently
const [chooser] = await Promise.all([
  fileChooser.waitForEvent(),
  query({ text: 'Select Profile Picture' }).click()
])

// 2. Supply the file(s) to the intercepted dialog
await chooser.setFiles('tests/fixtures/avatar.png')
```

## File Chooser Actions

Once you've intercepted a file chooser event (which returns a `FileChooser` handle), you can execute the following action:

* **`setFiles(files, options?)`**: Assigns files to the intercepted input. Files are resolved relative to the test runner's current working directory.
  ```ts
  // Upload a single file
  await chooser.setFiles('tests/fixtures/document.pdf')

  // Upload multiple files
  await chooser.setFiles([
    'tests/fixtures/image1.png',
    'tests/fixtures/image2.png'
  ])
  ```

## Best Practices (Dos and Don'ts)

### Dos
- **Do** use `Promise.all` to link the event promise and the click action together.
- **Do** verify if the underlying file input allows multiple files (e.g. `<input type="file" multiple>`) before passing an array of multiple files to `setFiles()`.

### Don't
- **Don't** await the click event before waiting for the chooser event:
  ```ts
  // INCORRECT: This will hang or time out!
  await query({ text: 'Upload' }).click()
  const chooser = await fileChooser.waitForEvent()
  await chooser.setFiles('file.png')
  ```
- **Don't** use `fileChooser` if the `<input type="file">` is visible or can be styled and selected. Use `locator.setInputFiles()` instead, as it is faster and requires less asynchronous boilerplate.
