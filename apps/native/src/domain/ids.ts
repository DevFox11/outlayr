/**
 * A v4 UUID for a new row id. Prefers the standard global `crypto.randomUUID`
 * when the runtime exposes it (node, and RN runtimes that polyfill WebCrypto);
 * otherwise it lazily falls back to `expo-crypto`. The lazy `require` keeps this
 * module free of a top-level native import so the data layer stays loadable under
 * the node test runner (which can't transform React Native's source).
 */
export function newId(): string {
    // SAFETY: Hermes has no `crypto` in its lib types; the shape asserted is
    // the one the very next line checks for before calling.
    const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (webCrypto?.randomUUID) {
        return webCrypto.randomUUID();
    }
    // SAFETY: `require` is untyped and the asserted type is the same module's.
    const expoCrypto = require("expo-crypto") as typeof import("expo-crypto");
    return expoCrypto.randomUUID();
}
