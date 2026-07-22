//
//  CategoryIconValidationTests.swift
//  OutlayrTests
//
//  Pins duplicate/missing-icon validation for category creation and editing.
//  The uniqueness pool is flat per income flag: subcategories share it with
//  top-level categories, and the two flags never collide with each other.
//

import CoreData
import Testing

@testable import Outlayr

@MainActor
struct CategoryIconValidationTests {
    private func makeSeededController() -> (DataController, CharacterizationFixture) {
        var f = CharacterizationFixture()
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        f.makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false, order: 0)
        f.makeCategory(in: context, name: "Salary", icon: "money-bag-01", income: true, order: 0)
        try? controller.save()
        return (controller, f)
    }

    @Test func duplicateIconInSamePoolIsRejected() {
        var (controller, f) = makeSeededController()
        defer { f.cleanup() }

        let result = controller.categories.categoryCheck(name: "Supermarket", icon: "shopping-cart-01", emoji: "", income: false)

        #expect(result.error == .duplicateIcon)
    }

    @Test func sameIconIsAllowedAcrossIncomeAndExpensePools() {
        var (controller, f) = makeSeededController()
        defer { f.cleanup() }

        let result = controller.categories.categoryCheck(name: "Refunds", icon: "shopping-cart-01", emoji: "", income: true)

        #expect(result.error == .none)
    }

    @Test func duplicateIconAndNameTogetherReportsDuplicate() {
        var (controller, f) = makeSeededController()
        defer { f.cleanup() }

        let result = controller.categories.categoryCheck(name: "Groceries", icon: "shopping-cart-01", emoji: "", income: false)

        #expect(result.error == .duplicate)
    }

    @Test func missingIconIsRejected() {
        var (controller, f) = makeSeededController()
        defer { f.cleanup() }

        let result = controller.categories.categoryCheck(name: "Travel", icon: "", emoji: "", income: false)

        #expect(result.error == .missingIcon)
    }

    @Test func missingIconAndNameReportsIncomplete() {
        var (controller, f) = makeSeededController()
        defer { f.cleanup() }

        let result = controller.categories.categoryCheck(name: "  ", icon: "", emoji: "", income: false)

        #expect(result.error == .incomplete)
    }

    @Test func freshIconIsAccepted() {
        var (controller, f) = makeSeededController()
        defer { f.cleanup() }

        let result = controller.categories.categoryCheck(name: "Travel", icon: "airplane-01", emoji: "", income: false)

        #expect(result.error == .none)
    }

    @Test func editKeepingOwnIconIsAllowed() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let groceries = f.makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false, order: 0)
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(name: "Groceries", icon: "shopping-cart-01", emoji: "", toEdit: groceries)

        #expect(result.error == .none)
    }

    @Test func editTakingASiblingIconIsRejected() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let groceries = f.makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false, order: 0)
        f.makeCategory(in: context, name: "Travel", icon: "airplane-01", income: false, order: 1)
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(name: "Groceries", icon: "airplane-01", emoji: "", toEdit: groceries)

        #expect(result.error == .duplicateIcon)
    }

    // Two categories with no stored icon both *render* the fallback glyph, but they
    // share no stored value — comparing resolved names here fabricated collisions.
    @Test func categoriesWithoutIconsDoNotCollide() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        f.makeCategory(in: context, name: "Sailboat Fund", icon: nil, income: false, order: 0)
        let wedding = f.makeCategory(in: context, name: "Wedding Fund", icon: nil, income: false, order: 1)
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(name: "Wedding Fund", icon: "", emoji: "", toEdit: wedding)

        #expect(result.error == .none)
    }

    @Test func explicitDuplicateRawIconsStillCollide() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        f.makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false, order: 0)
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Market", icon: "shopping-cart-01", emoji: "", income: false)

        #expect(result.error == .duplicateIcon)
    }

    // A legacy category must stay editable without being forced to pick an icon.
    @Test func editAllowsEmptyIconWhenStoredIconWasNil() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let legacy = f.makeCategory(in: context, name: "Sailboat Fund", icon: nil, income: false, order: 0)
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(name: "Sailboat Renamed", icon: "", emoji: "", toEdit: legacy)

        #expect(result.error == .none)
    }

    @Test func editStillRejectsEmptyIconWhenOneWasStored() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let groceries = f.makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false, order: 0)
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(name: "Groceries", icon: "", emoji: "", toEdit: groceries)

        #expect(result.error == .missingIcon)
    }

    // A name from a newer version must round-trip untouched rather than being
    // collapsed into the fallback it happens to render as.
    @Test func unknownButNonEmptyIconIsAcceptedOnEdit() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let future = f.makeCategory(in: context, name: "Garage", icon: "car-02-from-a-newer-version", income: false, order: 0)
        try? controller.save()

        let result = controller.categories.categoryCheckEdit(name: "Garage", icon: "car-02-from-a-newer-version", emoji: "", toEdit: future)

        #expect(result.error == .none)
    }

    @Test func subcategorySharesTheIconPoolWithTopLevelCategories() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let parent = f.makeCategory(in: context, name: "Food", icon: "restaurant-01", income: false, order: 0)
        let child = f.makeCategory(in: context, name: "Coffee", icon: "coffee-02", income: false, order: 1)
        child.parent = parent
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Cafes", icon: "coffee-02", emoji: "", income: false)

        #expect(result.error == .duplicateIcon)
    }

    // The suite covers the symbol contract now, not just icons: the emoji path must
    // hit the same gates with its own error case.
    @Test func duplicateEmojiReportsTheEmojiError() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let sailing = f.makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        sailing.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Boats", icon: "", emoji: "⛵️", income: false)
        #expect(result.error == .duplicateEmoji)
    }

    @Test func duplicateNameAndEmojiReportsTheCombinedError() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext

        let sailing = f.makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        sailing.emoji = "⛵️"
        try? controller.save()

        let result = controller.categories.categoryCheck(name: "Sailing", icon: "", emoji: "⛵️", income: false)
        #expect(result.error == .duplicate)
    }

    @Test func emojiOnlyCategoryPassesTheSymbolGate() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }

        let result = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
            .categories.categoryCheck(name: "Sailing", icon: "", emoji: "⛵️", income: false)
        #expect(result.error == .none)
    }
}
