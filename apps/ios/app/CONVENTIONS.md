# Outlayr — Code & Project Conventions

Conventions for the Outlayr iOS app (Swift 6 / SwiftUI, 2026). This is the
contract the codebase is organized around. When in doubt, match the nearest
existing code and keep changes minimal.

## 1. Architecture — Feature-based (Screaming)

The top-level folders name **what the app does**, not what the files *are*.
A stranger should read the folder tree and understand the product.

```
Outlayr/
├── App/            App entry point, lifecycle, root shell, tab bar, app lock
├── Features/       One folder per user-facing feature (see §2)
├── Core/           Cross-feature domain: persistence, shared models, data transfer, AI
├── DesignSystem/   Reusable visual language: colors, fonts, shapes, generic components
├── Shortcuts/      App Intents / Siri shortcuts (app-facing)
└── Support/        Foundation/SwiftUI extensions and low-level helpers
```

Cross-target code (used by the app **and** the widget/intent extensions) stays
reachable by all targets:
- `Shared/` (repo root) — identifiers shared by every target.
- `Core/Persistence/` — `DataController`, Core Data model, entity helpers. Shared
  code must not depend on any `Features/` type.

**Dependency direction (inward only):**
`App → Features → Core / DesignSystem → Support`
Features never import each other. Shared code (`Core`, `DesignSystem`, `Support`)
never depends on a `Feature`.

## 2. Feature folder layout

Each feature owns its screens, view-local components, and view-local models:

```
Features/<Feature>/
├── Views/          Screens & large subviews for this feature
├── Components/      View pieces reused only within this feature
└── Models/          Types owned by this feature (enums, view models, drafts)
```

- Promote a type to `Core/` only when a **second** feature needs it. Don't
  pre-abstract.
- Sub-features get a nested folder (e.g. `Transactions/Log/`,
  `Transactions/Templates/`, `Settings/Subviews/`).

Current features: `Budget`, `Transactions`, `Insights`, `Categories`,
`Settings`, `Search`.

## 3. Files

- **One primary type per file.** The filename equals that type
  (`BudgetView.swift` → `struct BudgetView`).
- A small supporting type (a `<10`-line helper enum/struct/style used only by the
  primary type) may share the file. Anything larger gets its own file.
- No "grab-bag" files (`…Views.swift`, `…Components.swift`, `…Helpers.swift`,
  `Helper.swift`). Name the file after the thing it contains.
- No dead code, backup files (`Foo~.swift`), or scratch/`Test…` playgrounds in
  the app target. Experiments live outside the build or in `#Preview`.
- Folder names use PascalCase, no spaces (`Subviews`, not `Settings Subviews`).

**Deliberate exceptions to one-type-per-file** (don't "fix" these blindly):
- `Core/Persistence/DataController.swift` and `Shortcuts/ShortcutsEntities.swift`
  declare helper types (`CustomError`, `LineGraphDataPoint`, the App Intent
  entities) that are compiled into the widget/intent extension targets too.
  Extract types from them only while also verifying multi-target membership —
  a new file must join every target that compiles its siblings, or the
  extension builds silently break. `DataController`'s domain fetches and
  mutations live in `CategoryRepository`/`BudgetRepository`/
  `TransactionRepository` (members of all four targets, reached via
  `dataController.categories/.budgets/.transactions`); `DataController` itself
  owns only the Core Data stack, `save()`/`results(for:)`, and the shared
  helper types.
- Widget files (`ExpenditureWidget/*Widget.swift`) keep the idiomatic WidgetKit
  cluster (`Widget` + `TimelineProvider` + `Entry` + `EntryView`) together;
  several are members of both the app and widget targets, so the same
  membership caveat applies.
- A genuinely cohesive pair may share a file: a `Shape` + its thin wrapper view
  (`Pencil.swift`), a `UIViewRepresentable` + its UIKit backing
  (`EmojiTextField.swift`), or a small family of modifiers behind one `View`
  extension (`Wiggle.swift`).

## 4. Naming

| Kind | Convention | Example |
|------|-----------|---------|
| Types (struct/class/enum/protocol) | PascalCase | `TransactionFormDraft` |
| Properties, methods, cases | camelCase | `fetchBudgets()`, `.thisWeek` |
| SwiftUI views | noun + `View` | `InsightsView` |
| View models / observable state | noun + `Model` | `AmountEntryModel` |
| Reusable modifiers | verb/adjective + `Modifier` | `KeyboardAwareModifier` |
| App Intents | verb + noun + `Intent` | `NewTransactionIntent` |
| App Intent entities | noun + `Entity` | `BudgetEntity` |
| Protocols | capability (`-able`) or role noun | `Identifiable`, `TransactionStore` |
| Booleans | `is/has/should` prefix | `isRecurring`, `hasBudget` |

- Use British/American spelling **consistently with the existing symbol**
  (`Colour…` already exists — don't rename in this pass; new code prefers `Color`).
- No abbreviations except well-known ones (`URL`, `ID`, `CSV`).

## 5. SwiftUI & state

- Prefer `@Observable` (Observation) over `ObservableObject`/`Combine`.
  `@State` for view-owned observable objects, `@Environment` for injected ones.
- Avoid `Combine`; use `async`/`await` and `AsyncSequence`.
- Keep `body` small — extract subviews into computed properties or `Component`
  files rather than growing one `body`.
- Custom colors go through the asset catalog + `Color` extension; never hardcode
  hex in a view. UI must support light **and** dark mode.
- Reference SF Symbols / Hugeicons by codepoint helper, not raw ligature strings.

## 6. Concurrency

- Swift Concurrency only. Annotate main-actor UI types with `@MainActor`.
- Data access (`DataController`) exposes `async` methods; no blocking the main
  thread for fetches.

## 7. Tests

- Swift Testing (`import Testing`, `@Test`, `#expect`) for unit tests;
  XCUIAutomation for UI tests. No new XCTest.
- Test file name mirrors the type under test: `AmountEntryModelTests.swift`.

## 8. Comments

Comment the **why**, never the **what**. No section-divider comments, no
restating the code. Code should read as its own documentation.

## 9. Project mechanics

- The project uses **legacy Xcode groups** (`objectVersion = 60`), so every file
  move rewrites `project.pbxproj`. Move files through Xcode (which keeps target
  membership intact), never with a raw `mv`. Do moves **serially** — parallel
  `project.pbxproj` writes corrupt it.
- Keep the project building green after each feature-sized batch of moves/splits.
