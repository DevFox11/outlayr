// Twenty suites mocked `@/i18n/context` with this exact body: return the key, so
// an assertion names the message it expects rather than the English copy, which
// would otherwise re-assert the catalog on every screen test.
//
// Replaces the module rather than spreading `jest.requireActual` over it. The
// real module reaches `photo-storage` and from there Skia, which jest-expo does
// not transform — loading it is what the per-file mocks were avoiding as much as
// the catalog itself.
//
// Two overrides take precedence over this file:
//   - a suite that asserts interpolated params declares its own `jest.mock`
//     with a body that appends them;
//   - a suite testing the module ITSELF calls `jest.unmock("@/i18n/context")`.
//
// That second case is the hazard worth naming: this is a first-party module, so
// without the unmock, `context.test.tsx` and `language-switch-reformat.test.tsx`
// would exercise this stub and pass while proving nothing. Any new test of
// `@/i18n/context` has to unmock it first.
jest.mock("@/i18n/context", () => ({
    LanguageProvider: ({ children }) => children,
    useLanguage: () => ({ language: "en" }),
    useTranslation: () => (key) => key,
}));
