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
import XCTest

@testable import Outlayr

final class CategorySymbolTests: CharacterizationTestCase {
    // MARK: - Precedence

    func testStoredIconWinsOverEmoji() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false)
        category.emoji = "🍎"

        guard case let .icon(icon) = category.displaySymbol else {
            return XCTFail("Expected the stored icon to win over the emoji")
        }
        XCTAssertEqual(icon.name, "shopping-cart-01")
    }

    func testEmojiRendersWhenIconIsUnset() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        category.emoji = "⛵️"

        XCTAssertEqual(category.displaySymbol, .emoji("⛵️"))
    }

    func testFallbackIconWhenNeitherSymbolIsSet() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let expense = makeCategory(in: context, name: "Legacy", icon: nil, income: false)
        let income = makeCategory(in: context, name: "Legacy Income", icon: nil, income: true)

        XCTAssertEqual(expense.displaySymbol, .icon(CategoryIconCatalog.fallbackExpense))
        XCTAssertEqual(income.displaySymbol, .icon(CategoryIconCatalog.fallbackIncome))
    }

    func testEmptyEmojiStringIsTreatedAsUnset() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = makeCategory(in: context, name: "Blank", icon: nil, income: false)
        category.emoji = ""

        XCTAssertNil(category.wrappedEmoji)
        XCTAssertEqual(category.displaySymbol, .icon(CategoryIconCatalog.fallbackExpense))
    }

    // MARK: - XOR selection

    func testSelectingAnIconClearsTheEmoji() {
        var selection = CategorySymbolSelection()
        selection.selectEmoji("🍎")
        selection.selectIcon("shopping-cart-01")

        XCTAssertEqual(selection.icon, "shopping-cart-01")
        XCTAssertEqual(selection.emoji, "")
    }

    func testSelectingAnEmojiClearsTheIcon() {
        var selection = CategorySymbolSelection()
        selection.selectIcon("shopping-cart-01")
        selection.selectEmoji("🍎")

        XCTAssertEqual(selection.emoji, "🍎")
        XCTAssertEqual(selection.icon, "")
    }

    func testSelectionIsEmptyOnlyWhenBothAreUnset() {
        XCTAssertTrue(CategorySymbolSelection().isEmpty)

        var withIcon = CategorySymbolSelection()
        withIcon.selectIcon("shopping-cart-01")
        XCTAssertFalse(withIcon.isEmpty)

        var withEmoji = CategorySymbolSelection()
        withEmoji.selectEmoji("🍎")
        XCTAssertFalse(withEmoji.isEmpty)
    }

    // MARK: - Duplicate detection

    func testDuplicateEmojiIsRejected() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let existing = makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        existing.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Boats", icon: "", emoji: "⛵️", income: false)
        XCTAssertEqual(result.error, .duplicateEmoji)
    }

    func testDistinctEmojiIsAccepted() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let existing = makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        existing.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Coffee", icon: "", emoji: "☕️", income: false)
        XCTAssertEqual(result.error, .none)
    }

    // An emoji and an icon are different namespaces; sharing a "slot" is meaningless.
    func testIconAndEmojiDoNotCollideWithEachOther() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        _ = makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false)
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Market", icon: "", emoji: "🛒", income: false)
        XCTAssertEqual(result.error, .none)
    }

    func testEmojiDuplicateIsScopedToTheIncomeSide() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let expense = makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        expense.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Charter Income", icon: "", emoji: "⛵️", income: true)
        XCTAssertEqual(result.error, .none)
    }

    // MARK: - Validation gates

    func testEmojiAloneSatisfiesTheSymbolRequirement() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())

        let result = controller.categories.categoryCheck(name: "Sailing", icon: "", emoji: "⛵️", income: false)
        XCTAssertEqual(result.error, .none)
    }

    func testNoSymbolAtAllIsStillMissingIcon() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())

        let result = controller.categories.categoryCheck(name: "Sailing", icon: "", emoji: "", income: false)
        XCTAssertEqual(result.error, .missingIcon)
    }

    func testNoNameAndNoSymbolIsIncomplete() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())

        let result = controller.categories.categoryCheck(name: "  ", icon: "", emoji: "", income: false)
        XCTAssertEqual(result.error, .incomplete)
    }

    // An emoji-only category is a legitimate symbol holder, so clearing it on edit
    // must be refused the same way clearing an icon is.
    func testEditingAnEmojiCategoryStillRequiresASymbol() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let sailing = makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        sailing.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(name: "Sailing", icon: "", emoji: "", toEdit: sailing)
        XCTAssertEqual(result.error, .missingIcon)
    }

    func testEditingAnEmojiCategoryAcceptsAnIconSwap() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let sailing = makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        sailing.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(
            name: "Sailing",
            icon: "airplane-01",
            emoji: "",
            toEdit: sailing
        )
        XCTAssertEqual(result.error, .none)
    }

    // The migrated-emoji allowance: a legacy row with neither symbol stays editable.
    func testSymbollessLegacyCategoryStaysEditable() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let legacy = makeCategory(in: context, name: "Sailboat Fund", icon: nil, income: false)
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(name: "Renamed", icon: "", emoji: "", toEdit: legacy)
        XCTAssertEqual(result.error, .none)
    }

    // MARK: - Emoji catalogue

    func testEmojiCatalogueHasNoDuplicates() {
        let all = CategoryEmojiCatalog.all
        XCTAssertEqual(all.count, Set(all).count, "The curated emoji palette contains a repeated entry")
    }

    func testEmojiCatalogueGroupTitlesMirrorTheIconCatalogue() {
        let iconTitles = Set(CategoryIconCatalog.groups.map(\.title))
        let emojiTitles = Set(CategoryEmojiCatalog.groups.map(\.title))
        XCTAssertEqual(emojiTitles, iconTitles, "The two picker tabs must present the same group vocabulary")
    }

    // Pinned deliberately: the palette is curated, so a change in size is a change
    // in product surface and should require updating this number on purpose.
    func testEmojiCatalogueSizeIsPinned() {
        XCTAssertEqual(CategoryEmojiCatalog.all.count, CategoryEmojiCatalog.curatedCount)
    }

    // MARK: - Selection <-> storage round trip

    func testSeedNormalisesLegacyRowsHoldingBothSymbols() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false)
        category.emoji = "🍎"

        let selection = CategorySymbolSelection(category: category)
        XCTAssertEqual(selection.icon, "shopping-cart-01")
        XCTAssertEqual(selection.emoji, "")
    }

    func testSeedKeepsEmojiWhenNoIconIsStored() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        category.emoji = "⛵️"

        let selection = CategorySymbolSelection(category: category)
        XCTAssertEqual(selection.emoji, "⛵️")
        XCTAssertEqual(selection.icon, "")
    }

    func testApplyWritesTheIconAndClearsTheEmoji() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        category.emoji = "⛵️"

        var selection = CategorySymbolSelection()
        selection.selectIcon("airplane-01")
        selection.apply(to: category)

        XCTAssertEqual(category.icon, "airplane-01")
        XCTAssertNil(category.emoji)
    }

    func testApplyMapsAnEmptySelectionToNil() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = makeCategory(in: context, name: "Sailing", icon: "airplane-01", income: false)
        CategorySymbolSelection().apply(to: category)

        XCTAssertNil(category.icon)
        XCTAssertNil(category.emoji)
    }

    func testSelectionSurvivesAnApplySeedRoundTrip() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        var selection = CategorySymbolSelection()
        selection.selectEmoji("⛵️")
        selection.apply(to: category)

        XCTAssertEqual(CategorySymbolSelection(category: category), selection)
    }

    // MARK: - Emoji comparison

    func testPresentationVariantsOfTheSameGlyphCollide() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let existing = makeCategory(in: context, name: "Cafe", icon: nil, income: false)
        existing.emoji = "☕️"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Coffee", icon: "", emoji: "☕", income: false)
        XCTAssertEqual(result.error, .duplicateEmoji)
    }

    func testSkinToneVariantsDoNotCollide() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let existing = makeCategory(in: context, name: "Thumbs", icon: nil, income: false)
        existing.emoji = "👍"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Approval", icon: "", emoji: "👍🏽", income: false)
        XCTAssertEqual(result.error, .none)
    }

    func testWhitespacePaddedEmojiStillCollides() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let existing = makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        existing.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Boats", icon: "", emoji: " ⛵️ ", income: false)
        XCTAssertEqual(result.error, .duplicateEmoji)
    }

    // MARK: - Post-migration contract

    // The icon backfill is gone: a suggestion-named category with no icon must stay
    // symbol-less so a deliberately chosen emoji can never be overwritten.
    func testSuggestionNamedCategoryIsNotAutoAssignedAnIcon() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let groceries = makeCategory(in: context, name: "Groceries", icon: nil, income: false)
        try? controller.save()

        XCTAssertNil(groceries.icon)
        XCTAssertEqual(groceries.displaySymbol, .icon(CategoryIconCatalog.fallbackExpense))
    }

    func testEmojiOnSuggestionNamedCategorySurvives() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let groceries = makeCategory(in: context, name: "Groceries", icon: nil, income: false)
        groceries.emoji = "🍎"
        try? controller.save()

        XCTAssertNil(groceries.icon)
        XCTAssertEqual(groceries.displaySymbol, .emoji("🍎"))
    }
}

// MARK: - Emoji detection boundaries

final class EmojiDetectionTests: XCTestCase {
    func testDefaultPresentationSingleScalarEmojiAreDetected() {
        // The regression F4 fixes: ⌚/⌛ are single-scalar emoji-presentation glyphs
        // that a "needs more than one scalar" rule silently dropped.
        XCTAssertEqual("⌚".onlyEmoji(), "⌚")
        XCTAssertEqual("⌛".onlyEmoji(), "⌛")
    }

    func testVariationSelectorEmojiAreDetected() {
        XCTAssertEqual("☕️".onlyEmoji(), "☕️")
    }

    func testCompositeEmojiSurviveIntact() {
        XCTAssertEqual("🇦🇷".onlyEmoji(), "🇦🇷")
        XCTAssertEqual("👨‍👩‍👧".onlyEmoji(), "👨‍👩‍👧")
        XCTAssertEqual("👍🏽".onlyEmoji(), "👍🏽")
        XCTAssertEqual("1️⃣".onlyEmoji(), "1️⃣")
    }

    func testPlainCharactersAreNotEmoji() {
        XCTAssertEqual("a".onlyEmoji(), "")
        XCTAssertEqual("1".onlyEmoji(), "")
        XCTAssertEqual("#".onlyEmoji(), "")
        XCTAssertEqual("".onlyEmoji(), "")
    }

    func testMixedInputKeepsOnlyEmoji() {
        XCTAssertEqual("a🍎b".onlyEmoji(), "🍎")
    }

    // The picker keeps only the newest glyph, so a pasted run must truncate to one.
    func testMultiEmojiPasteTruncatesToTheLast() {
        XCTAssertEqual(String("🍎🍕🌮".onlyEmoji().suffix(1)), "🌮")
        XCTAssertEqual(String("👍🏽".onlyEmoji().suffix(1)), "👍🏽")
    }

    func testComparisonKeyFoldsPresentationVariantsOnly() {
        XCTAssertEqual("☕️".emojiComparisonKey, "☕".emojiComparisonKey)
        XCTAssertEqual(" ⛵️ ".emojiComparisonKey, "⛵️".emojiComparisonKey)
        XCTAssertNotEqual("👍🏽".emojiComparisonKey, "👍".emojiComparisonKey)
    }
}

// MARK: - Core Data model versions

final class ManagedObjectModelVersionTests: XCTestCase {
    // Every prior .mom must keep shipping or existing stores can't migrate forward.
    // This machine-checks the convention that a pbxproj edit could silently break.
    func testAllThreeModelVersionsShipInTheBundle() throws {
        let bundle = Bundle(for: DataController.self)
        let momdURL = try XCTUnwrap(
            bundle.url(forResource: "MainModel", withExtension: "momd"),
            "MainModel.momd is missing from the app bundle"
        )

        let contents = try FileManager.default.contentsOfDirectory(
            at: momdURL,
            includingPropertiesForKeys: nil
        )
        let momNames = Set(contents.filter { $0.pathExtension == "mom" }.map { $0.lastPathComponent })

        for expected in ["MainModel.mom", "MainModel 2.mom", "MainModel 3.mom"] {
            XCTAssertTrue(momNames.contains(expected), "\(expected) is no longer shipped")
        }
    }

    func testEveryShippedModelVersionLoads() throws {
        let bundle = Bundle(for: DataController.self)
        let momdURL = try XCTUnwrap(bundle.url(forResource: "MainModel", withExtension: "momd"))
        let contents = try FileManager.default.contentsOfDirectory(at: momdURL, includingPropertiesForKeys: nil)

        for mom in contents where mom.pathExtension == "mom" {
            XCTAssertNotNil(
                NSManagedObjectModel(contentsOf: mom),
                "\(mom.lastPathComponent) failed to load as a managed object model"
            )
        }
    }

    // The attribute the emoji feature reuses; losing it would be a silent data break.
    func testCurrentModelStillDefinesTheCategoryEmojiAttribute() throws {
        let controller = DataController(
            inMemory: true,
            now: { Date() },
            calendar: .current,
            sharedDefaults: UserDefaults(suiteName: "ManagedObjectModelVersionTests") ?? .standard
        )
        let entity = try XCTUnwrap(
            controller.container.managedObjectModel.entitiesByName["Category"],
            "Category entity missing from the current model"
        )
        XCTAssertNotNil(entity.attributesByName["emoji"])
        XCTAssertNotNil(entity.attributesByName["icon"])
    }
}

// MARK: - Adaptive tile shading

/// Pins the self-calibrating glyph guarantee: for ANY tint — palette or
/// custom-picked — the derived glyph clears WCAG's 3:1 graphics contrast
/// against its own wash, in both color schemes.
final class CategoryTileShadingTests: XCTestCase {
    private let extremes = ["#FFFFFF", "#000000", "#FFFF00", "#F6D24A", "#B8D6FA", "#0B0B0B"]

    func testEveryPaletteColorClearsGraphicsContrastInBothSchemes() {
        for hex in Color.colorArray {
            for scheme in [ColorScheme.light, .dark] {
                let achieved = CategoryTileShading.achievedContrast(for: Color(hex: hex), in: scheme)
                XCTAssertGreaterThanOrEqual(
                    achieved, 3.0,
                    "\(hex) in \(scheme) only reaches \(achieved):1"
                )
            }
        }
    }

    func testCustomExtremeColorsClearGraphicsContrast() {
        for hex in extremes {
            for scheme in [ColorScheme.light, .dark] {
                let achieved = CategoryTileShading.achievedContrast(for: Color(hex: hex), in: scheme)
                XCTAssertGreaterThanOrEqual(
                    achieved, 3.0,
                    "\(hex) in \(scheme) only reaches \(achieved):1"
                )
            }
        }
    }

    func testAlreadyLegibleTintIsLeftUnshaded() {
        let navy = Color(hex: "#2D4B7B")
        let derived = CategoryTileShading.glyph(for: navy, in: .light)
        XCTAssertEqual(derived.toHex(), navy.toHex(), "dark tints should keep their exact hue in light mode")
    }
}
