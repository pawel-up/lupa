# Cookies API

The `cookies` API in Lupa allows you to read, write, and delete cookies within the browser context. This is highly useful for managing session states, verifying cookie-based application behavior, or bypassing authentication screens by directly seeding login sessions.

---

## The Cookies Singleton

Import the pre-instantiated `cookies` singleton to manipulate cookies:

```ts
import { cookies } from '@pawel-up/lupa/commands'
```

---

## Cookies Actions

All cookies commands are asynchronous and return a promise.

### Adding Cookies

* **`add(cookie | cookie[])`**: Sets one or more cookies in the browser context.
  ```ts
  // Adding a single cookie
  await cookies.add({
    name: 'session-id',
    value: 'xyz789abc123',
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax'
  })

  // Adding multiple cookies
  await cookies.add([
    { name: 'theme', value: 'dark', url: 'http://localhost:3000' },
    { name: 'discount-code', value: 'SUMMER20', url: 'http://localhost:3000' }
  ])
  ```
  *Note: Either `url` or `domain` is required to associate the cookie with the correct origin.*

### Retrieving Cookies

* **`getAll()`**: Retrieves all cookies currently set in the active browser context.
  ```ts
  const allCookies = await cookies.getAll()
  
  // Find a specific cookie
  const session = allCookies.find(c => c.name === 'session-id')
  ```

### Clearing Cookies

* **`clear()`**: Deletes all cookies in the browser context.
  ```ts
  await cookies.clear()
  ```

---

## Bypassing Login in Tests

One of the most common use cases for the Cookies API is to bypass login screens. Instead of filling out username and password forms in every test (which slow down the test suite), you can authenticate once, or seed a pre-calculated token directly via cookies:

```ts
import { test } from '@pawel-up/lupa'
import { cookies } from '@pawel-up/lupa/commands'

test.group('Authenticated Dashboard', (group) => {
  group.beforeEach(async () => {
    // Inject mock session cookie to bypass login flow
    await cookies.add({
      name: 'auth_token',
      value: 'mock-secure-jwt-token',
      url: 'http://localhost:3000'
    })
  })

  test('should display secure statistics', async ({ assert }) => {
    // Navigate straight to dashboard
    // The page will read the auth_token cookie and treat us as authenticated
  })
})
```

---

## Cookie Options Reference

When calling `cookies.add(cookie)`, each cookie object supports the following options:
* **`name`** *(string, required)*: The name of the cookie.
* **`value`** *(string, required)*: The value of the cookie.
* **`url`** *(string, optional)*: The origin URL to associate the cookie with (e.g. `http://localhost:3000`). Either `url` or `domain` must be provided.
* **`domain`** *(string, optional)*: The domain of the cookie.
* **`path`** *(string, optional)*: The path of the cookie. Defaults to `/`.
* **`expires`** *(number, optional)*: Unix epoch time in seconds when the cookie expires.
* **`httpOnly`** *(boolean, optional)*: Whether the cookie is HTTP-only.
* **`secure`** *(boolean, optional)*: Whether the cookie requires HTTPS.
* **`sameSite`** *('Lax' | 'Strict' | 'None', optional)*: SameSite attribute for the cookie.

---

## Best Practices (Dos and Don'ts)

### Dos
- **Do** provide either a `url` or `domain` when calling `cookies.add()`. If neither is provided, the cookie might not attach correctly to the domain under test.
- **Do** clear cookies in a `teardown` or `beforeEach` hook if you need a clean session state between test cases.

### Don'ts
- **Don't** use `cookies.add()` to write cookies from client-side Javascript inside the application itself. Use `document.cookie` if testing the application code's behavior, and use Lupa's `cookies` command API for global environment setup before loading the page.
