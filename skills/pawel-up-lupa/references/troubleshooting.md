# Troubleshooting Lupa

## Troubleshooting: Vite 504 Errors & Unexpected Token 'export'

When running tests in Lupa, you may encounter opaque browser import errors. The two most common culprits are Vite's dynamic dependency discovery (`504 Outdated Optimize Dep`) and silent `esbuild` transform errors.

### 1. `504 Outdated Optimize Dep` (Hanging Tests or Import Errors)

**Symptoms:**
- Tests hang indefinitely or fail with `Failed to fetch dynamically imported module`.
- Vite's debug logs (`DEBUG=vite:* npx lupa test`) show new dependencies being discovered and optimized during the test run.

**Cause:**
Lupa runs in a headless browser environment. When a test imports a new, unoptimized dependency (especially massive barrel files), Vite pauses to re-bundle the dependency graph. By the time Vite finishes, it sends a `504` to the browser, expecting it to reload. Because Lupa is a headless test runner, it does not automatically reload the page, causing the test to fail or hang.

**Solutions:**
1. **Avoid Barrel Files:** Import specific functions/classes directly from their underlying files rather than huge index/barrel files.
2. **Explicitly Include Dependencies:** Add the dynamically discovered dependencies to `optimizeDeps.include` in `lupa.config.ts`.
   ```typescript
   vite: {
     optimizeDeps: {
       include: [
         'lit/decorators.js',
         'lit/directives/class-map.js',
         // Add any other dynamically discovered deep imports here
       ]
     }
   }
   ```

### 2. `SyntaxError: Unexpected token 'export'` (or similar parsing errors)

**Symptoms:**
- Tests fail instantly with `Import Error: ... [Error [SyntaxError]: Unexpected token 'export']`.
- The browser fails to parse the file as an ES module.

**Cause:**
This typically masks an underlying **Vite/esbuild transform error**. If your custom `esbuild` plugin or Vite config is misconfigured (e.g., passing invalid options to `esbuild.transform`), Vite fails to compile the file. Depending on the Vite version, it may serve an HTML error page or an uncompiled file to the browser, which the browser then fails to parse, throwing a generic `SyntaxError`.

**Common Mistake (esbuild options):**
Passing `experimentalDecorators: true` directly to `esbuild.transform()` is invalid and will silently fail the build. It must be nested inside `tsconfigRaw`.

**Solution:**
Check your `lupa.config.ts` Vite plugins for invalid configurations. For `esbuild`, correctly pass TypeScript options via `tsconfigRaw`:
```typescript
// ❌ INCORRECT
const result = await esbuild.transform(code, {
  experimentalDecorators: true,
})

// ✅ CORRECT
const result = await esbuild.transform(code, {
  tsconfigRaw: {
    compilerOptions: {
      experimentalDecorators: true,
    },
  },
})
```
