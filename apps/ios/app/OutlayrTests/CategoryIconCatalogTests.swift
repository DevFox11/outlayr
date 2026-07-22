//
//  CategoryIconCatalogTests.swift
//  OutlayrTests
//
//  Pins the emoji→icon contract: every shipped icon name must resolve through
//  CategoryIconCatalog, and legacy categories must come out of migration either
//  matched to a suggestion or left unset for the render-path fallback.
//

import CoreData
import Testing

@testable import Outlayr

@MainActor
struct CategoryIconCatalogTests {
    @Test func everySuggestedExpenseIconResolves() {
        for suggestion in SuggestedCategory.expenses {
            #expect(
                CategoryIconCatalog.icon(named: suggestion.icon) != nil,
                "Expense suggestion \(suggestion.name) references unknown icon \(suggestion.icon)"
            )
        }
    }

    @Test func everySuggestedIncomeIconResolves() {
        for suggestion in SuggestedCategory.incomes {
            #expect(
                CategoryIconCatalog.icon(named: suggestion.icon) != nil,
                "Income suggestion \(suggestion.name) references unknown icon \(suggestion.icon)"
            )
        }
    }

    @Test func fallbacksResolveThroughTheCatalog() {
        for income in [true, false] {
            let fallback = CategoryIconCatalog.fallback(income: income)
            #expect(CategoryIconCatalog.icon(named: fallback.name) == fallback)
        }
    }

    @Test func unknownIconNameDoesNotResolve() {
        #expect(CategoryIconCatalog.icon(named: "not-a-real-glyph") == nil)
    }

    @Test func wrappedIconFallsBackWhenIconIsMissing() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let expense = f.makeCategory(in: context, name: "Legacy", icon: nil, income: false)
        let income = f.makeCategory(in: context, name: "Legacy Income", icon: nil, income: true)

        #expect(expense.wrappedIcon == CategoryIconCatalog.fallbackExpense)
        #expect(income.wrappedIcon == CategoryIconCatalog.fallbackIncome)
    }

    // The regression this contract exists to prevent: two categories with no icon
    // used to collide on the shared fallback name and become permanently unsavable.
    @Test func iconlessCategoriesRemainEditable() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let sailboat = f.makeCategory(in: context, name: "Sailboat Fund", icon: nil, income: false, order: 0)
        _ = f.makeCategory(in: context, name: "Wedding Fund", icon: nil, income: false, order: 1)
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(name: "Sailboat Fund", icon: "", emoji: "", toEdit: sailboat)
        #expect(result.error == .none)
    }

    @Test func suggestionLookupAcceptsRawAndLocalizedNames() {
        #expect(SuggestedCategory.match(name: "Groceries", income: false)?.icon == "shopping-cart-01")
        #expect(
            SuggestedCategory.match(name: NSLocalizedString("Groceries", comment: "category name"), income: false)?.icon
                == "shopping-cart-01"
        )
    }

    @Test func suggestionLookupIsScopedToTheIncomeFlag() {
        #expect(SuggestedCategory.match(name: "Groceries", income: true) == nil)
        #expect(SuggestedCategory.match(name: "Paycheck", income: false) == nil)
    }

    @Test func searchMatchesKeywordSynonymsNotJustNames() {
        let money = CategoryIconCatalog.icons(matching: "money").map(\.name)
        for expected in ["money-bag-01", "wallet-01", "coins-01"] {
            #expect(money.contains(expected), "\"money\" should surface \(expected)")
        }

        #expect(CategoryIconCatalog.icons(matching: "lightning").map(\.name).contains("flash"))
        #expect(CategoryIconCatalog.icons(matching: "subscription").map(\.name).contains("repeat"))
    }

    @Test func searchIgnoresCaseAndSurroundingWhitespace() {
        #expect(
            CategoryIconCatalog.icons(matching: "  LIGHTNING ").map(\.name)
                == CategoryIconCatalog.icons(matching: "lightning").map(\.name)
        )
    }

    @Test func emptySearchReturnsTheWholeDedupedCatalog() {
        let all = CategoryIconCatalog.icons(matching: "")
        let names = all.map(\.name)

        #expect(Set(names).count == all.count, "Search results must not repeat an icon")

        // Compare against the raw catalog count, not a deduped one: if a name is
        // ever duplicated across groups both sides would otherwise shrink together
        // and the dedup contract would stop being pinned.
        #expect(all.count == CategoryIconCatalog.groups.flatMap(\.icons).count)
        #expect(Set(names) == Set(CategoryIconCatalog.groups.flatMap(\.icons).map(\.name)))
    }

    @Test func whitespaceOnlySearchIsTreatedAsEmpty() {
        #expect(
            CategoryIconCatalog.icons(matching: "   ").map(\.name)
                == CategoryIconCatalog.icons(matching: "").map(\.name)
        )
    }

    @Test func searchWithNoMatchesReturnsNothing() {
        #expect(CategoryIconCatalog.icons(matching: "zzzzz").isEmpty)
    }
}
