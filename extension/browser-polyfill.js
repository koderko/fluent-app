// Minimal cross-browser polyfill for browser/chrome namespace.
// On Chrome, `browser` is undefined; on Firefox, both exist.
if (typeof globalThis.browser === 'undefined' && typeof globalThis.chrome !== 'undefined') {
  // Chrome supports promises on most APIs in MV3 already; this aliases for code parity.
  globalThis.browser = globalThis.chrome;
}
