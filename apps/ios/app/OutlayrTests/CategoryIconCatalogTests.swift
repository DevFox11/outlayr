//
//  CategoryIconCatalogTests.swift
//  OutlayrTests
//
//  Pins the emoji→icon contract: every shipped icon name must resolve through
//  CategoryIconCatalog, and legacy categories must come out of migration either
//  matched to a suggestion or left unset for the render-path fallback.
//

import CoreData
import XCTest

@testable import Outlayr

final class CategoryIconCatalogTests: CharacterizationTestCase {
    func testEverySuggestedExpenseIconResolves() {
        for suggestion in SuggestedCategory.expenses {
            XCTAssertNotNil(
                CategoryIconCatalog.icon(named: suggestion.icon),
                "Expense suggestion \(suggestion.name) references unknown icon \(suggestion.icon)"
            )
        }
    }

    func testEverySuggestedIncomeIconResolves() {
        for suggestion in SuggestedCategory.incomes {
            XCTAssertNotNil(
                CategoryIconCatalog.icon(named: suggestion.icon),
                "Income suggestion \(suggestion.name) references unknown icon \(suggestion.icon)"
            )
        }
    }

    func testFallbacksResolveThroughTheCatalog() {
        for income in [true, false] {
            let fallback = CategoryIconCatalog.fallback(income: income)
            XCTAssertEqual(CategoryIconCatalog.icon(named: fallback.name), fallback)
        }
    }

    func testUnknownIconNameDoesNotResolve() {
        XCTAssertNil(CategoryIconCatalog.icon(named: "not-a-real-glyph"))
    }

    func testWrappedIconFallsBackWhenIconIsMissing() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let expense = makeCategory(in: context, name: "Legacy", icon: nil, income: false)
        let income = makeCategory(in: context, name: "Legacy Income", icon: nil, income: true)

        XCTAssertEqual(expense.wrappedIcon, CategoryIconCatalog.fallbackExpense)
        XCTAssertEqual(income.wrappedIcon, CategoryIconCatalog.fallbackIncome)
    }

    func testMigrationAdoptsSuggestionIcon() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let groceries = makeCategory(in: context, name: "Groceries", icon: nil, income: false)
        let paycheck = makeCategory(in: context, name: "Paycheck", icon: nil, income: true)

        controller.migrateCategoryIcons()

        XCTAssertEqual(groceries.icon, "shopping-cart-01")
        XCTAssertEqual(paycheck.icon, "money-bag-01")
    }

    // An icon backfill has no business touching colour: a user who recoloured a
    // suggestion-named category must not lose that choice on update.
    func testMigrationNeverWritesColour() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let groceries = makeCategory(in: context, name: "Groceries", icon: nil, income: false)
        groceries.colour = "#123456"

        controller.migrateCategoryIcons()

        XCTAssertEqual(groceries.colour, "#123456")
    }

    // Persisting a fallback name here would give every unmatched category the same
    // stored icon, which the duplicate-icon check then reads as a collision.
    func testMigrationLeavesUnknownNamesUnset() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let custom = makeCategory(in: context, name: "Sailboat Fund", icon: nil, income: false)
        custom.colour = "#123456"

        controller.migrateCategoryIcons()

        XCTAssertNil(custom.icon)
        XCTAssertEqual(custom.wrappedIcon, CategoryIconCatalog.fallback(income: false))
        XCTAssertEqual(custom.colour, "#123456")
    }

    // The regression this whole rewrite exists to prevent: two unmatched categories
    // used to collide on the shared fallback name and become permanently unsavable.
    func testMigratedUnknownCategoriesRemainEditable() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let sailboat = makeCategory(in: context, name: "Sailboat Fund", icon: nil, income: false, order: 0)
        let wedding = makeCategory(in: context, name: "Wedding Fund", icon: nil, income: false, order: 1)
        controller.save()

        controller.migrateCategoryIcons()

        XCTAssertNil(sailboat.icon)
        XCTAssertNil(wedding.icon)

        let result = controller.categoryCheckEdit(name: "Sailboat Fund", icon: "", toEdit: sailboat)
        XCTAssertEqual(result.error, .none)
    }

    // Categories are persisted with the localized suggestion name, so a non-English
    // store must still match back to its suggestion.
    //
    // Under an English test host the localized form equals the raw literal, so this
    // pins the path the migration takes rather than proving translation works; a
    // real non-English assertion needs the suite run under another locale.
    func testMigrationMatchesLocalizedSuggestionNames() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let localizedName = NSLocalizedString("Groceries", comment: "category name")
        let groceries = makeCategory(in: context, name: localizedName, icon: nil, income: false)

        controller.migrateCategoryIcons()

        XCTAssertEqual(groceries.icon, "shopping-cart-01")
    }

    func testSuggestionLookupAcceptsRawAndLocalizedNames() {
        XCTAssertEqual(SuggestedCategory.match(name: "Groceries", income: false)?.icon, "shopping-cart-01")
        XCTAssertEqual(
            SuggestedCategory.match(name: NSLocalizedString("Groceries", comment: "category name"), income: false)?.icon,
            "shopping-cart-01"
        )
    }

    func testSuggestionLookupIsScopedToTheIncomeFlag() {
        XCTAssertNil(SuggestedCategory.match(name: "Groceries", income: true))
        XCTAssertNil(SuggestedCategory.match(name: "Paycheck", income: false))
    }

    // The migration runs on every launch now, so re-running must be a no-op.
    func testMigrationIsIdempotent() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let groceries = makeCategory(in: context, name: "Groceries", icon: nil, income: false)
        let custom = makeCategory(in: context, name: "Sailboat Fund", icon: nil, income: false)

        controller.migrateCategoryIcons()
        controller.migrateCategoryIcons()

        XCTAssertEqual(groceries.icon, "shopping-cart-01")
        XCTAssertNil(custom.icon)
    }

    func testMigrationLeavesAlreadyMigratedCategoriesUntouched() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        // A user who renamed a category onto a suggestion name after picking their
        // own icon must not have that choice overwritten on a later launch.
        let category = makeCategory(in: context, name: "Groceries", icon: "apple", income: false)
        category.colour = "#123456"

        controller.migrateCategoryIcons()

        XCTAssertEqual(category.icon, "apple")
        XCTAssertEqual(category.colour, "#123456")
    }

    func testSearchMatchesKeywordSynonymsNotJustNames() {
        let money = CategoryIconCatalog.icons(matching: "money").map(\.name)
        for expected in ["money-bag-01", "wallet-01", "coins-01"] {
            XCTAssertTrue(money.contains(expected), "\"money\" should surface \(expected)")
        }

        XCTAssertTrue(CategoryIconCatalog.icons(matching: "lightning").map(\.name).contains("flash"))
        XCTAssertTrue(CategoryIconCatalog.icons(matching: "subscription").map(\.name).contains("repeat"))
    }

    func testSearchIgnoresCaseAndSurroundingWhitespace() {
        XCTAssertEqual(
            CategoryIconCatalog.icons(matching: "  LIGHTNING ").map(\.name),
            CategoryIconCatalog.icons(matching: "lightning").map(\.name)
        )
    }

    func testEmptySearchReturnsTheWholeDedupedCatalog() {
        let all = CategoryIconCatalog.icons(matching: "")
        let names = all.map(\.name)

        XCTAssertEqual(Set(names).count, all.count, "Search results must not repeat an icon")

        // Compare against the raw catalog count, not a deduped one: if a name is
        // ever duplicated across groups both sides would otherwise shrink together
        // and the dedup contract would stop being pinned.
        XCTAssertEqual(all.count, CategoryIconCatalog.groups.flatMap(\.icons).count)
        XCTAssertEqual(Set(names), Set(CategoryIconCatalog.groups.flatMap(\.icons).map(\.name)))
    }

    func testWhitespaceOnlySearchIsTreatedAsEmpty() {
        XCTAssertEqual(
            CategoryIconCatalog.icons(matching: "   ").map(\.name),
            CategoryIconCatalog.icons(matching: "").map(\.name)
        )
    }

    func testSearchWithNoMatchesReturnsNothing() {
        XCTAssertTrue(CategoryIconCatalog.icons(matching: "zzzzz").isEmpty)
    }
}
