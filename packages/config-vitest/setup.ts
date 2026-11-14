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

  // Node 26+ experimental localStorage can evaluate to undefined under JSDOM
  // unless --localstorage-file is supplied. Provide an in-memory fallback.
  if (
    typeof window.localStorage === "undefined" ||
    typeof window.localStorage.clear !== "function"
  ) {
    const store = new Map<string, string>();
    const storageMock = {
      getItem: (key: string) => store.get(String(key)) ?? null,
      setItem: (key: string, value: string) => {
        store.set(String(key), String(value));
      },
      removeItem: (key: string) => {
        store.delete(String(key));
      },
      clear: () => {
        store.clear();
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    };
    Object.defineProperty(window, "localStorage", {
      value: storageMock,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: storageMock,
      configurable: true,
      writable: true,
    });
  }
}
