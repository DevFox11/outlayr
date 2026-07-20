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

    // The regression this contract exists to prevent: two categories with no icon
    // used to collide on the shared fallback name and become permanently unsavable.
    func testIconlessCategoriesRemainEditable() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let sailboat = makeCategory(in: context, name: "Sailboat Fund", icon: nil, income: false, order: 0)
        _ = makeCategory(in: context, name: "Wedding Fund", icon: nil, income: false, order: 1)
        controller.save()

        let result = controller.categoryCheckEdit(name: "Sailboat Fund", icon: "", emoji: "", toEdit: sailboat)
        XCTAssertEqual(result.error, .none)
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
