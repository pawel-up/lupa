# Emulation API

The `emulation` API in Lupa allows you to customize the browser context's environment. This is useful for testing responsive viewport layouts, media queries (such as dark mode or print styles), geolocation features, API permissions, and offline application behavior.

---

## The Emulation Singleton

To configure emulation settings, import the pre-instantiated `emulation` singleton:

```ts
import { emulation } from '@pawel-up/lupa/commands'
```

---

## Emulation Actions

All emulation commands are asynchronous and return a promise.

### Viewport Emulation

* **`setViewport(viewport)`**: Dynamically resizes the browser window viewport.
  ```ts
  await emulation.setViewport({
    width: 375,
    height: 812
  })
  ```

> [!NOTE]
> **Dynamic Viewport Limitations**: Playwright's `setViewportSize()` only supports changing the viewport `width` and `height` dynamically on a running page. Context-level device emulation settings such as `deviceScaleFactor` (pixel ratio), `isMobile`, and `hasTouch` are configured when the browser context is initialized and cannot be updated dynamically during a test.


### Media Features Emulation

* **`emulateMedia(media)`**: Simulates page media types and CSS features (e.g. print layout or dark mode).
  ```ts
  // Emulate dark mode color scheme
  await emulation.emulateMedia({ colorScheme: 'dark' })

  // Emulate print CSS styles
  await emulation.emulateMedia({ media: 'print' })

  // Emulate accessibility preferences
  await emulation.emulateMedia({ reducedMotion: 'reduce' })
  ```

### Geolocation Emulation

* **`setGeolocation(geolocation)`**: Emulates a specific geographical location. Pass `null` to clear the geolocation override.
  ```ts
  // Emulate Tokyo, Japan
  await emulation.setGeolocation({
    latitude: 35.6762,
    longitude: 139.6503,
    accuracy: 100
  })

  // Clear geolocation override
  await emulation.setGeolocation(null)
  ```

### Permissions Emulation

* **`grantPermissions(permissions, options?)`**: Grants specific browser permissions to the current context.
  ```ts
  await emulation.grantPermissions(['geolocation', 'notifications'])

  // Limit to a specific origin
  await emulation.grantPermissions(['clipboard-read'], {
    origin: 'https://example.com'
  })
  ```

> [!WARNING]
> **Browser Compatibility**: Supported permissions differ significantly between browsers (e.g. Chromium vs. WebKit/Safari vs. Firefox), and even between different versions of the same browser. Overrides for unsupported permissions may fail silently or throw errors depending on the browser engine.
>
> Common permission types supported by various browsers:
> - `'geolocation'`
> - `'notifications'`
> - `'clipboard-read'`
> - `'clipboard-write'`
> - `'camera'`
> - `'microphone'`
> - `'accelerometer'`
> - `'gyroscope'`
> - `'magnetometer'`
> - `'background-sync'`
> - `'midi'`
> - `'midi-sysex'` (system-exclusive MIDI)
> - `'ambient-light-sensor'`
> - `'screen-wake-lock'`
> - `'storage-access'`
> - `'local-fonts'`
> - `'local-network-access'`
> - `'payment-handler'`

* **`clearPermissions()`**: Clears all granted permission overrides and restores default browser settings.
  ```ts
  await emulation.clearPermissions()
  ```

### Network Offline Emulation

* **`setOffline(offline)`**: Simulates network disconnection by going offline context-wide.
  ```ts
  // Disconnect network
  await emulation.setOffline(true)

  // Restore network
  await emulation.setOffline(false)
  ```

## Persistence Behavior

> [!IMPORTANT]
> **Context-Wide State**: Emulation configurations apply to the entire active browser context. Unlike mock utilities that automatically reset after a test completes, emulation changes (such as viewports, permissions, or offline status) **remain active until explicitly reverted**.
>
> If you set the browser offline or change the viewport in a test, make sure to reset it in the test teardown or `afterEach` hook:
> ```ts
> test.group('Offline Workflow', (group) => {
>   group.teardown(async () => {
>     // Ensure the browser goes back online for subsequent tests
>     await emulation.setOffline(false)
>   })
> 
>   test('should show offline banner', async ({ assert }) => {
>     await emulation.setOffline(true)
>     // assert offline banner UI...
>   })
> })
> ```

---

## Deprecation Notice

> [!WARNING]
> The legacy global functions `setViewport()` and `emulateMedia()` are deprecated and will be removed:
> ```ts
> import { setViewport, emulateMedia } from '@pawel-up/lupa/commands' // DEPRECATED
> ```
> Use the equivalent methods on the `emulation` singleton:
> ```ts
> import { emulation } from '@pawel-up/lupa/commands'
> 
> await emulation.setViewport({ width: 1280, height: 720 })
> await emulation.emulateMedia({ colorScheme: 'light' })
> ```

---

## Best Practices (Dos and Don'ts)

### Dos
- **Do** remember to clean up permissions, geolocations, and network overrides in the group teardown (`teardown` or `afterEach`).
- **Do** test responsive layouts by dynamically changing viewports using `emulation.setViewport`.

### Don'ts
- **Don't** assume that calling `emulation.setGeolocation` will work without granting geolocation permission first. You must grant the permissions needed:
  ```ts
  await emulation.grantPermissions(['geolocation'])
  await emulation.setGeolocation({ latitude: 35.6762, longitude: 139.6503 })
  ```
- **Don't** use `emulation.setOffline(true)` if you only want to mock a specific failing API endpoint. Use the Network Mocking API instead, as it is scoped to individual requests and doesn't cut off all internet/localhost traffic.
