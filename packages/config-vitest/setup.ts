// Global test setup for shared silent-mode stubs.
// Runs before every test file to suppress known JSDOM noise that bypasses
// Vitest's `silent`/`onConsoleLog` interception (e.g. `Not implemented: Window's scrollTo()`).
if (typeof window !== "undefined") {
  // JSDOM does not implement scrollTo/scrollBy — calling them emits
  // `"Not implemented: Window's scrollTo() method"` to stderr outside of
  // Vitest's console mock/silent handling. Unconditionally stub to silence.
  // @ts-expect-error jsdom stub
  window.scrollTo = () => {};
  // @ts-expect-error jsdom stub
  window.scrollBy = () => {};
  if (typeof window.scroll !== "undefined") {
    // @ts-expect-error jsdom stub
    window.scroll = () => {};
  }
  // Also ensure Element.scrollIntoView is stubbed (complementary to per-test utils).
  if (typeof Element !== "undefined") {
    Element.prototype.scrollIntoView = () => {};
  }
}
