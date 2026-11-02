export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Node.js v25+ ships a built-in `localStorage` global, but it only works when
    // `--localstorage-file=<path>` is passed. Without that flag the object exists
    // but none of its methods (getItem, setItem, …) are functions, which causes
    // WalletConnect to throw during SSR. Always replace it with a no-op shim so
    // WalletConnect can initialize safely on the server.
    (global as unknown as Record<string, unknown>).localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
  }
}
