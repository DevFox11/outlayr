import type { OxlintOverride } from "oxlint";
import ultraciteFmt from "ultracite/oxfmt";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import jest from "ultracite/oxlint/jest";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import vitest from "ultracite/oxlint/vitest";
import { defineConfig } from "vite-plus";

// Paths ultracite's shared ignore list does not know about. Reasoning for the
// non-obvious ones: `drizzle` and `uniwind-types.d.ts` are generated, `ios` /
// `android` / `Pods` are CNG output, and `.agents` / `.claude` are vendored
// skill trees we do not own.
const projectIgnores = [
    "**/.expo",
    "**/.nx",
    "**/dev-dist",
    "**/.zed",
    "**/.vscode",
    "**/src-tauri",
    "**/.alchemy",
    "**/.source",
    "**/drizzle",
    "**/uniwind-types.d.ts",
    "**/ios",
    "**/android",
    "**/Pods",
    "**/*.icon",
    "**/.agents",
    "**/.playwright-mcp",
    "**/.claude",
    "skills-lock.json",
];

// `*.md` and `*.html` are formats oxfmt handles and oxlint does not, so they
// only need excluding on the format side. The design artifacts under
// docs/design are visual references reviewed as rendered pages, and
// `proseWrap: "never"` would rejoin every wrapped paragraph in docs/ — both are
// churn, not migration. Drop these two entries to opt in.
const formatOnlyIgnores = ["**/*.html", "**/*.md"];

const NATIVE_SOURCE = "apps/native/src/**";

// Assertion-count and title-shape rules describe how someone else writes tests,
// and three of these rewrite what an assertion means: `toHaveBeenCalled()` ->
// `toHaveBeenCalledWith()` turns "the spy ran" into "the spy ran with no
// arguments"; `toEqual` -> `toStrictEqual` starts counting the `undefined`
// members every `accessibilityState` carries; and `expect(await x)` ->
// `await expect(x).resolves` assumes `x` is a promise, which the synchronous
// drizzle reads are not. Both runners name these identically under their own
// prefix; the entries only one plugin defines are listed per-runner below.
const RUNNER_OPT_OUT = [
    "expect-expect",
    "max-expects",
    "no-conditional-expect",
    "prefer-called-with",
    "prefer-each",
    "prefer-expect-resolves",
    "prefer-strict-equal",
    "require-to-throw-message",
    "require-top-level-describe",
];
// `prefer-importing-jest-globals` wants an explicit `@jest/globals` import in
// every test — jest-expo injects the globals instead and the package is not
// installed, so its fix added 259 unresolvable imports. `prefer-jest-mocked`
// rewrites `getLocales as jest.Mock` to `jest.mocked(getLocales)`, which
// restores the real signature and rejects every partial mock return value.
const JEST_ONLY_OPT_OUT = [
    "no-untyped-mock-factory",
    "prefer-ending-with-an-expect",
    "prefer-importing-jest-globals",
    "prefer-jest-mocked",
];
// `prefer-describe-function-title` substitutes the referenced binding for the
// string title, so `describe("CURRENCY_DECIMALS", …)` became
// `describe(CURRENCY_DECIMALS, …)` — a type error for every subject that is a
// constant rather than a function, and a silent suite rename for the rest.
const VITEST_ONLY_OPT_OUT = ["prefer-describe-function-title", "require-mock-type-parameters"];

// The jest and vitest presets both claim `**/*.{test,spec}.*`, so extending both
// reports every assertion twice. This repo splits cleanly — apps/native runs
// jest-expo and the packages run vitest — so each preset's overrides get
// re-anchored to the tree that actually uses that runner. The opt-outs have to
// be merged in here rather than added as a later override: a rule from a plugin
// is only resolvable in a block that enables the plugin.
const scopeTo = (prefix: string, plugin: string, extraOptOut: string[], preset: { overrides?: OxlintOverride[] }) =>
    (preset.overrides ?? []).map((override) => ({
        ...override,
        files: override.files.map((glob) => `${prefix}/${glob}`),
        rules: {
            ...override.rules,
            ...Object.fromEntries([...RUNNER_OPT_OUT, ...extraOptOut].map((rule) => [`${plugin}/${rule}`, "off"])),
        },
    }));

export default defineConfig({
    fmt: {
        ...ultraciteFmt,
        ignorePatterns: [...ultraciteFmt.ignorePatterns, ...formatOnlyIgnores, ...projectIgnores],
        printWidth: 120,
        tabWidth: 4,
    },
    lint: {
        // anti-slop goes last: its preset also turns off the two core rules that
        // fight it (`typescript/consistent-indexed-object-style` autofixes into a
        // `Record` alias that `no-known-value-widening` then re-flags, and
        // `unicorn/no-immediate-mutation` bans that rule's own empty-accumulator
        // escape), and a later config wins.
        extends: [core, react, tanstack, antiSlop],
        // Biome knows `describe`/`it` but neither of these, and the runner presets
        // ship rules without globals.
        globals: {
            __DEV__: "readonly",
            jest: "readonly",
        },
        ignorePatterns: [...core.ignorePatterns, ...projectIgnores],
        // anti-slop registers its own plugin entry through the preset above.
        jsPlugins: ["oxlint-tailwindcss"],
        overrides: [
            ...scopeTo("apps/native", "jest", JEST_ONLY_OPT_OUT, jest),
            ...scopeTo("packages", "vitest", VITEST_ONLY_OPT_OUT, vitest),
            {
                // Test code is written to be read top-to-bottom, not to be tuned.
                // Async mocks, sequential steps, assertion regexes, wide test-double
                // types, inline expectation comments and stub classes inside a
                // `jest.mock` factory are not what these rules protect. Mirrors how
                // ultracite core already scopes `no-console` and `no-explicit-any`.
                files: [
                    "**/*.test.{ts,tsx}",
                    "**/*.spec.{ts,tsx}",
                    "**/test.helpers.ts",
                    "apps/native/jest/**",
                    "**/scripts/**",
                ],
                rules: {
                    // A test declares its own doubles, so anti-slop's evidence
                    // rules have nothing to protect here: the cast, the widened
                    // literal and the `unknown` argument are the fixture. Module
                    // mocking is how jest-expo isolates a native module at all.
                    "anti-slop/no-chained-type-assertions": "off",
                    "anti-slop/no-known-value-widening": "off",
                    "anti-slop/no-module-mocking": "off",
                    "anti-slop/no-runtime-typeof": "off",
                    "anti-slop/no-unknown-parameters": "off",
                    "anti-slop/no-unknown-returns": "off",
                    "anti-slop/no-unsafe-dictionary-type": "off",
                    "anti-slop/require-safety-comment-for-type-assertion": "off",
                    "class-methods-use-this": "off",
                    "import/first": "off",
                    "import/no-named-as-default-member": "off",
                    "max-classes-per-file": "off",
                    "no-await-in-loop": "off",
                    "no-bitwise": "off",
                    "no-empty": "off",
                    "no-empty-function": "off",
                    "no-implicit-globals": "off",
                    "no-inline-comments": "off",
                    "no-use-before-define": "off",
                    "promise/avoid-new": "off",
                    "react/state-in-constructor": "off",
                    "require-await": "off",
                    "typescript/class-literal-property-style": "off",
                    "typescript/no-explicit-any": "off",
                    "unicorn/consistent-function-scoping": "off",
                    "unicorn/import-style": "off",
                    "unicorn/no-await-expression-member": "off",
                    "unicorn/no-object-as-default-parameter": "off",
                },
            },
            {
                files: ["packages/backend/convex/**"],
                rules: {
                    // In Convex the filename *is* the API path:
                    // `convex/exchangeRates.ts` is `api.exchangeRates.get`.
                    // Kebab-casing would rewrite every client call site.
                    "unicorn/filename-case": ["error", { case: "camelCase" }],
                    // Convex's generated tsconfig pins `lib: ["ES2021"]`;
                    // `Array.prototype.at` is ES2022.
                    "unicorn/prefer-at": "off",
                },
            },
            {
                // An expo-router dynamic segment is named for the param it binds, so
                // `[subcategoryId].tsx` is `params.subcategoryId`. Kebab-casing the
                // file renames the route param.
                files: ["apps/native/src/app/**"],
                rules: {
                    "unicorn/filename-case": "off",
                },
            },
            {
                // A widget body is stringified and evaluated in the extension's own
                // bare JSContext, so a helper hoisted to module scope resolves to
                // nothing and paints a ReferenceError on the tile.
                // `widget-scope.test.ts` enforces the inverse rule: nothing at
                // module scope but the component itself.
                files: ["apps/native/src/widgets/**"],
                rules: {
                    "unicorn/consistent-function-scoping": "off",
                },
            },
            {
                // RFC 4122 defines the version and variant bits in bitwise terms.
                files: ["apps/native/src/domain/uuid5.ts", "apps/native/src/domain/confetti.ts"],
                rules: {
                    "no-bitwise": "off",
                },
            },
            {
                // The data layer's public surface. Splitting it is its own change:
                // every consumer imports from `@/data/budgets`, not from the core.
                files: ["apps/native/src/data/budgets.ts"],
                rules: {
                    "oxc/no-barrel-file": "off",
                },
            },
            {
                files: [NATIVE_SOURCE],
                rules: {
                    "no-restricted-imports": [
                        "error",
                        {
                            paths: [
                                {
                                    importNames: ["useLiveQuery"],
                                    message:
                                        "Drizzle's useLiveQuery renders one empty frame before its query answers. Import useLiveQuery from @/data/live-query, which reads in render.",
                                    name: "drizzle-orm/expo-sqlite",
                                },
                                {
                                    message:
                                        "A direct call fires whatever the Haptics setting says. Use useHaptics from @/lib/use-haptics.",
                                    name: "expo-haptics",
                                },
                            ],
                        },
                    ],
                },
            },
            {
                // The two modules the restriction above points at.
                files: ["apps/native/src/data/live-query.ts", "apps/native/src/lib/use-haptics.ts"],
                rules: {
                    "no-restricted-imports": "off",
                },
            },
            {
                // The two assertion chains this codebase cannot retire, both against
                // a type we do not own. React Native's `BodyInit` omits the typed
                // array its `fetch` actually sends, and drizzle's builders are
                // generic per table so `Database` shares no members with the
                // single-code-path writer the sync engine calls. Each is one named,
                // commented hop — `anyWriter` in the second case.
                files: ["apps/native/src/lib/convex.ts", "apps/native/src/data/sync-engine-core.ts"],
                rules: {
                    "anti-slop/no-chained-type-assertions": "off",
                },
            },
            {
                // `AppleLifecycleContext` is a structural view of better-auth's
                // endpoint context, narrowed by assertion. Its members are
                // better-auth's to declare: tightening `updateAccount` to the `void`
                // the callers use removes the overlap the assertion needs.
                files: ["packages/backend/convex/providerLifecycle.ts"],
                rules: {
                    "anti-slop/no-unknown-returns": "off",
                },
            },
        ],
        rules: {
            // anti-slop (shipped by ultracite, extended above) rejects low-evidence
            // typing: casts with no stated reason, `unknown`/`object` inputs, and
            // values that cross a boundary unparsed. Its preset sets every rule to
            // `error` and nothing here restates a severity — the tree satisfies all
            // fifteen as shipped. The only carve-outs left are scoped to files:
            // the test block above (where the cast and the widened literal ARE the
            // fixture), and the three source files named in their own overrides.
            //
            // oxlint counts cyclomatic complexity where Biome counted cognitive, so
            // the old threshold of 25 does not carry across. On the new metric the
            // cluster that is barely over sits at 26-33 and only the transaction
            // form is genuinely out of hand, so 35 keeps drawing the same line.
            complexity: ["error", { max: 35 }],
            // `x == null` is the nullish check, not a lazy `===`: `undefined ==
            // null` is true, `undefined === null` is false. 63 files use the
            // `!= null` counterpart. Both rules have to relax — `eqeqeq` alone
            // still leaves `no-eq-null` flagging all 462 sites.
            eqeqeq: ["error", "always", { null: "ignore" }],
            // Components and helpers are declared with `function` throughout, and
            // the tree relies on hoisting (`RootNavigator` references `RouteGate`
            // above its definition). Converting 2000+ declarations to arrow
            // expressions is an idiom change, not a toolchain migration.
            "func-style": "off",
            "no-eq-null": "off",
            // Hoisting is load-bearing here for the same reason.
            "no-use-before-define": ["error", { classes: false, functions: false, variables: false }],
            // Metro resolves `require()` for static assets and for the lazy native
            // modules that must not load at import time. This rule and
            // `unicorn/prefer-module` both assume an ESM graph this app lacks.
            "node/global-require": "off",
            "one-var": ["error", "never"],
            // Adding the `u` flag switches escape handling and `\w` semantics for
            // every regex in the CSV, currency and i18n parsers at once; named
            // capture groups rewrite the same expressions. Neither is verifiable in
            // a toolchain migration.
            "prefer-named-capture-group": "off",
            // The four sites are the promise primitives themselves — a timer bridge
            // for `yieldToUi`, and a hold that never settles so a committed CTA
            // cannot re-enable. There is no existing promise to await instead.
            "promise/avoid-new": "off",
            // 90 promise chains and 44 callback APIs predate this gate. Left as a
            // follow-up so the migration is not also a rewrite.
            "promise/prefer-await-to-callbacks": "off",
            "promise/prefer-await-to-then": "off",
            "react/exhaustive-deps": "warn",
            "react/function-component-definition": "off",
            // Two deliberate shapes, 15 sites: `const [seed] = useState(() => …)`
            // takes a render-stable snapshot and wants no setter, and
            // `const [x, setXState] = useState(…)` names the raw setter apart
            // because the exported `setX` does more than assign.
            "react/hook-use-state": "off",
            // Three DOM assumptions that do not survive React Native. `style` here
            // is a Skia `Path` mode (`style="stroke"`), not a CSS object; RN passes
            // handlers named for what they do (`onPress={openSheet}`) rather than
            // `handleX`; `.reduce` is how the aggregates in domain/ are written.
            "react/jsx-handler-names": "off",
            // Real signal, but a refactor backlog rather than a gate: Biome never
            // ran the compiler rules, so every finding here is pre-existing.
            "react/react-compiler": "warn",
            "react/style-prop-object": "off",
            // Every site is a callback satisfying a Promise-returning contract
            // (`photos: async () => clearStoredPhotos()`, a Convex `handler`).
            // Dropping `async` turns a synchronous throw into a thrown error where
            // the caller is written to handle a rejection.
            "require-await": "off",
            "require-unicode-regexp": "off",
            // Correctness only. `enforce-sort-order` and the plugin's other style
            // rules stay off: oxfmt already owns class order inside `cn`/`tv`/`clsx`,
            // and the plugin's sorter would additionally reorder 302 raw `className`
            // strings that nothing else touches.
            "tailwindcss/no-conflicting-classes": "error",
            "tailwindcss/no-contradicting-variants": "error",
            "tailwindcss/no-deprecated-classes": "error",
            "tailwindcss/no-duplicate-classes": "error",
            "tailwindcss/no-unknown-classes": "error",
            "tailwindcss/no-unnecessary-whitespace": "error",
            // `import()` type annotations are the correct idiom for
            // `jest.mock<typeof import("…")>` factories and ambient asset
            // declarations; the `import type` preference itself stays on.
            "typescript/consistent-type-imports": ["error", { disallowTypeAnnotations: false }],
            // Renames the caught binding to `error` *and* rewrites the shorthand
            // property built from it — `catch (cause) { failure = { cause } }`
            // became `{ error }`, silently changing the object's shape.
            "unicorn/catch-error-name": "off",
            "unicorn/no-array-reduce": "off",
            // `.sort()` / `.reverse()` in place is deliberate on arrays this code
            // just built, and the call sites already spread first where the input is
            // shared. `.toSorted()` / `.toReversed()` are a different allocation and
            // a different Hermes baseline than the tests, which run on node, cover.
            "unicorn/no-array-reverse": "off",
            "unicorn/no-array-sort": "off",
            // Its fix drops the argument rather than the value, so it turns
            // `mockResolvedValue(undefined)` into an arity error and guts the tests
            // whose whole subject is what a function does with `undefined`.
            "unicorn/no-useless-undefined": "off",
            "unicorn/prefer-module": "off",
            // `Number()` is not `parseFloat()`: the CSV importer and the numpad both
            // rely on a trailing-garbage cell parsing to its leading number rather
            // than to NaN.
            "unicorn/prefer-number-coercion": "off",
            // Swaps the array literal for `new Set(…)` without touching the
            // `: string[]` annotation or the `.includes` call sites.
            "unicorn/prefer-set-has": "off",
        },
        settings: {
            tailwindcss: {
                entryPoint: "apps/native/global.css",
            },
        },
    },
    // Runs from .vite-hooks/pre-commit via `vp staged`. `vp check --fix` covers
    // both halves of the gate, and vp re-stages what it rewrites — a lint error
    // reverts the working tree and blocks the commit rather than half-applying.
    staged: {
        "*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,json,jsonc,css}": "vp check --fix",
    },
});
