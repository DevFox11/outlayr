//
//  CategorySymbolTests.swift
//  OutlayrTests
//
//  Pins the icon-XOR-emoji contract: which symbol a category renders, how a
//  selection clears the other kind, and how duplicate detection treats the two
//  namespaces.
//

import CoreData
import SwiftUI
import Testing

@testable import Outlayr

@MainActor
struct CategorySymbolTests {
    // MARK: - Precedence

    @Test func storedIconWinsOverEmoji() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = f.makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false)
        category.emoji = "🍎"

        guard case let .icon(icon) = category.displaySymbol else {
            Issue.record("Expected the stored icon to win over the emoji")
            return
        }
        #expect(icon.name == "shopping-cart-01")
    }

    @Test func emojiRendersWhenIconIsUnset() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = f.makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        category.emoji = "⛵️"

        #expect(category.displaySymbol == .emoji("⛵️"))
    }

    @Test func fallbackIconWhenNeitherSymbolIsSet() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let expense = f.makeCategory(in: context, name: "Legacy", icon: nil, income: false)
        let income = f.makeCategory(in: context, name: "Legacy Income", icon: nil, income: true)

        #expect(expense.displaySymbol == .icon(CategoryIconCatalog.fallbackExpense))
        #expect(income.displaySymbol == .icon(CategoryIconCatalog.fallbackIncome))
    }

    @Test func emptyEmojiStringIsTreatedAsUnset() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = f.makeCategory(in: context, name: "Blank", icon: nil, income: false)
        category.emoji = ""

        #expect(category.wrappedEmoji == nil)
        #expect(category.displaySymbol == .icon(CategoryIconCatalog.fallbackExpense))
    }

    // MARK: - XOR selection

    @Test func selectingAnIconClearsTheEmoji() {
        var selection = CategorySymbolSelection()
        selection.selectEmoji("🍎")
        selection.selectIcon("shopping-cart-01")

        #expect(selection.icon == "shopping-cart-01")
        #expect(selection.emoji == "")
    }

    @Test func selectingAnEmojiClearsTheIcon() {
        var selection = CategorySymbolSelection()
        selection.selectIcon("shopping-cart-01")
        selection.selectEmoji("🍎")

        #expect(selection.emoji == "🍎")
        #expect(selection.icon == "")
    }

    @Test func selectionIsEmptyOnlyWhenBothAreUnset() {
        #expect(CategorySymbolSelection().isEmpty)

        var withIcon = CategorySymbolSelection()
        withIcon.selectIcon("shopping-cart-01")
        #expect(withIcon.isEmpty == false)

        var withEmoji = CategorySymbolSelection()
        withEmoji.selectEmoji("🍎")
        #expect(withEmoji.isEmpty == false)
    }

    // MARK: - Duplicate detection

    @Test func duplicateEmojiIsRejected() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let existing = f.makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        existing.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Boats", icon: "", emoji: "⛵️", income: false)
        #expect(result.error == .duplicateEmoji)
    }

    @Test func distinctEmojiIsAccepted() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let existing = f.makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        existing.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Coffee", icon: "", emoji: "☕️", income: false)
        #expect(result.error == .none)
    }

    // An emoji and an icon are different namespaces; sharing a "slot" is meaningless.
    @Test func iconAndEmojiDoNotCollideWithEachOther() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        _ = f.makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false)
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Market", icon: "", emoji: "🛒", income: false)
        #expect(result.error == .none)
    }

    @Test func emojiDuplicateIsScopedToTheIncomeSide() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let expense = f.makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        expense.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Charter Income", icon: "", emoji: "⛵️", income: true)
        #expect(result.error == .none)
    }

    // MARK: - Validation gates

    @Test func emojiAloneSatisfiesTheSymbolRequirement() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())

        let result = controller.categories.categoryCheck(name: "Sailing", icon: "", emoji: "⛵️", income: false)
        #expect(result.error == .none)
    }

    @Test func noSymbolAtAllIsStillMissingIcon() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())

        let result = controller.categories.categoryCheck(name: "Sailing", icon: "", emoji: "", income: false)
        #expect(result.error == .missingIcon)
    }

    @Test func noNameAndNoSymbolIsIncomplete() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())

        let result = controller.categories.categoryCheck(name: "  ", icon: "", emoji: "", income: false)
        #expect(result.error == .incomplete)
    }

    // An emoji-only category is a legitimate symbol holder, so clearing it on edit
    // must be refused the same way clearing an icon is.
    @Test func editingAnEmojiCategoryStillRequiresASymbol() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let sailing = f.makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        sailing.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(name: "Sailing", icon: "", emoji: "", toEdit: sailing)
        #expect(result.error == .missingIcon)
    }

    @Test func editingAnEmojiCategoryAcceptsAnIconSwap() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let sailing = f.makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        sailing.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(
            name: "Sailing",
            icon: "airplane-01",
            emoji: "",
            toEdit: sailing
        )
        #expect(result.error == .none)
    }

    // The migrated-emoji allowance: a legacy row with neither symbol stays editable.
    @Test func symbollessLegacyCategoryStaysEditable() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let legacy = f.makeCategory(in: context, name: "Sailboat Fund", icon: nil, income: false)
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(name: "Renamed", icon: "", emoji: "", toEdit: legacy)
        #expect(result.error == .none)
    }

    // MARK: - Emoji catalogue

    @Test func emojiCatalogueHasNoDuplicates() {
        let all = CategoryEmojiCatalog.all
        #expect(all.count == Set(all).count, "The curated emoji palette contains a repeated entry")
    }

    @Test func emojiCatalogueGroupTitlesMirrorTheIconCatalogue() {
        let iconTitles = Set(CategoryIconCatalog.groups.map(\.title))
        let emojiTitles = Set(CategoryEmojiCatalog.groups.map(\.title))
        #expect(emojiTitles == iconTitles, "The two picker tabs must present the same group vocabulary")
    }

    // Pinned deliberately: the palette is curated, so a change in size is a change
    // in product surface and should require updating this number on purpose.
    @Test func emojiCatalogueSizeIsPinned() {
        #expect(CategoryEmojiCatalog.all.count == CategoryEmojiCatalog.curatedCount)
    }

    // MARK: - Selection <-> storage round trip

    @Test func seedNormalisesLegacyRowsHoldingBothSymbols() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = f.makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false)
        category.emoji = "🍎"

        let selection = CategorySymbolSelection(category: category)
        #expect(selection.icon == "shopping-cart-01")
        #expect(selection.emoji == "")
    }

    @Test func seedKeepsEmojiWhenNoIconIsStored() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = f.makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        category.emoji = "⛵️"

        let selection = CategorySymbolSelection(category: category)
        #expect(selection.emoji == "⛵️")
        #expect(selection.icon == "")
    }

    @Test func applyWritesTheIconAndClearsTheEmoji() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = f.makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        category.emoji = "⛵️"

        var selection = CategorySymbolSelection()
        selection.selectIcon("airplane-01")
        selection.apply(to: category)

        #expect(category.icon == "airplane-01")
        #expect(category.emoji == nil)
    }

    @Test func applyMapsAnEmptySelectionToNil() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = f.makeCategory(in: context, name: "Sailing", icon: "airplane-01", income: false)
        CategorySymbolSelection().apply(to: category)

        #expect(category.icon == nil)
        #expect(category.emoji == nil)
    }

    @Test func selectionSurvivesAnApplySeedRoundTrip() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = f.makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        var selection = CategorySymbolSelection()
        selection.selectEmoji("⛵️")
        selection.apply(to: category)

        #expect(CategorySymbolSelection(category: category) == selection)
    }

    // MARK: - Emoji comparison

    @Test func presentationVariantsOfTheSameGlyphCollide() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let existing = f.makeCategory(in: context, name: "Cafe", icon: nil, income: false)
        existing.emoji = "☕️"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Coffee", icon: "", emoji: "☕", income: false)
        #expect(result.error == .duplicateEmoji)
    }

    @Test func skinToneVariantsDoNotCollide() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let existing = f.makeCategory(in: context, name: "Thumbs", icon: nil, income: false)
        existing.emoji = "👍"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Approval", icon: "", emoji: "👍🏽", income: false)
        #expect(result.error == .none)
    }

    @Test func whitespacePaddedEmojiStillCollides() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let existing = f.makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        existing.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Boats", icon: "", emoji: " ⛵️ ", income: false)
        #expect(result.error == .duplicateEmoji)
    }

    // MARK: - Post-migration contract

    // The icon backfill is gone: a suggestion-named category with no icon must stay
    // symbol-less so a deliberately chosen emoji can never be overwritten.
    @Test func suggestionNamedCategoryIsNotAutoAssignedAnIcon() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let groceries = f.makeCategory(in: context, name: "Groceries", icon: nil, income: false)
        try? controller.save()

        #expect(groceries.icon == nil)
        #expect(groceries.displaySymbol == .icon(CategoryIconCatalog.fallbackExpense))
    }

    @Test func emojiOnSuggestionNamedCategorySurvives() throws {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let groceries = f.makeCategory(in: context, name: "Groceries", icon: nil, income: false)
        groceries.emoji = "🍎"
        try? controller.save()

        #expect(groceries.icon == nil)
        #expect(groceries.displaySymbol == .emoji("🍎"))
    }
}

// MARK: - Emoji detection boundaries

struct EmojiDetectionTests {
    @Test func defaultPresentationSingleScalarEmojiAreDetected() {
        // The regression F4 fixes: ⌚/⌛ are single-scalar emoji-presentation glyphs
        // that a "needs more than one scalar" rule silently dropped.
        #expect("⌚".onlyEmoji() == "⌚")
        #expect("⌛".onlyEmoji() == "⌛")
    }

    @Test func variationSelectorEmojiAreDetected() {
        #expect("☕️".onlyEmoji() == "☕️")
    }

    @Test func compositeEmojiSurviveIntact() {
        #expect("🇦🇷".onlyEmoji() == "🇦🇷")
        #expect("👨‍👩‍👧".onlyEmoji() == "👨‍👩‍👧")
        #expect("👍🏽".onlyEmoji() == "👍🏽")
        #expect("1️⃣".onlyEmoji() == "1️⃣")
    }

    @Test func plainCharactersAreNotEmoji() {
        #expect("a".onlyEmoji() == "")
        #expect("1".onlyEmoji() == "")
        #expect("#".onlyEmoji() == "")
        #expect("".onlyEmoji() == "")
    }

    @Test func mixedInputKeepsOnlyEmoji() {
        #expect("a🍎b".onlyEmoji() == "🍎")
    }

    // The picker keeps only the newest glyph, so a pasted run must truncate to one.
    @Test func multiEmojiPasteTruncatesToTheLast() {
        #expect(String("🍎🍕🌮".onlyEmoji().suffix(1)) == "🌮")
        #expect(String("👍🏽".onlyEmoji().suffix(1)) == "👍🏽")
    }

    @Test func comparisonKeyFoldsPresentationVariantsOnly() {
        #expect("☕️".emojiComparisonKey == "☕".emojiComparisonKey)
        #expect(" ⛵️ ".emojiComparisonKey == "⛵️".emojiComparisonKey)
        #expect("👍🏽".emojiComparisonKey != "👍".emojiComparisonKey)
    }
}

// MARK: - Core Data model versions

@MainActor
struct ManagedObjectModelVersionTests {
    // Every prior .mom must keep shipping or existing stores can't migrate forward.
    // This machine-checks the convention that a pbxproj edit could silently break.
    @Test func allThreeModelVersionsShipInTheBundle() throws {
        let bundle = Bundle(for: DataController.self)
        let momdURL = try #require(
            bundle.url(forResource: "MainModel", withExtension: "momd"),
            "MainModel.momd is missing from the app bundle"
        )

        let contents = try FileManager.default.contentsOfDirectory(
            at: momdURL,
            includingPropertiesForKeys: nil
        )
        let momNames = Set(contents.filter { $0.pathExtension == "mom" }.map { $0.lastPathComponent })

        for expected in ["MainModel.mom", "MainModel 2.mom", "MainModel 3.mom"] {
            #expect(momNames.contains(expected), "\(expected) is no longer shipped")
        }
    }

    @Test func everyShippedModelVersionLoads() throws {
        let bundle = Bundle(for: DataController.self)
        let momdURL = try #require(bundle.url(forResource: "MainModel", withExtension: "momd"))
        let contents = try FileManager.default.contentsOfDirectory(at: momdURL, includingPropertiesForKeys: nil)

        for mom in contents where mom.pathExtension == "mom" {
            #expect(
                NSManagedObjectModel(contentsOf: mom) != nil,
                "\(mom.lastPathComponent) failed to load as a managed object model"
            )
        }
    }

    // The attribute the emoji feature reuses; losing it would be a silent data break.
    @Test func currentModelStillDefinesTheCategoryEmojiAttribute() throws {
        let controller = DataController(
            inMemory: true,
            now: { Date() },
            calendar: .current,
            sharedDefaults: UserDefaults(suiteName: "ManagedObjectModelVersionTests") ?? .standard
        )
        let entity = try #require(
            controller.container.managedObjectModel.entitiesByName["Category"],
            "Category entity missing from the current model"
        )
        #expect(entity.attributesByName["emoji"] != nil)
        #expect(entity.attributesByName["icon"] != nil)
    }
}

// MARK: - Adaptive tile shading

/// Pins the self-calibrating glyph guarantee: for ANY tint — palette or
/// custom-picked — the derived glyph clears WCAG's 3:1 graphics contrast
/// against its own wash, in both color schemes.
struct CategoryTileShadingTests {
    private let extremes = ["#FFFFFF", "#000000", "#FFFF00", "#F6D24A", "#B8D6FA", "#0B0B0B"]

    @Test func everyPaletteColorClearsGraphicsContrastInBothSchemes() {
        for hex in Color.colorArray {
            for scheme in [ColorScheme.light, .dark] {
                let achieved = CategoryTileShading.achievedContrast(for: Color(hex: hex), in: scheme)
                #expect(
                    achieved >= 3.0,
                    "\(hex) in \(scheme) only reaches \(achieved):1"
                )
            }
        }
    }

    @Test func customExtremeColorsClearGraphicsContrast() {
        for hex in extremes {
            for scheme in [ColorScheme.light, .dark] {
                let achieved = CategoryTileShading.achievedContrast(for: Color(hex: hex), in: scheme)
                #expect(
                    achieved >= 3.0,
                    "\(hex) in \(scheme) only reaches \(achieved):1"
                )
            }
        }
    }

    @Test func alreadyLegibleTintIsLeftUnshaded() {
        let navy = Color(hex: "#2D4B7B")
        let derived = CategoryTileShading.glyph(for: navy, in: .light)
        #expect(derived.toHex() == navy.toHex(), "dark tints should keep their exact hue in light mode")
    }
}
