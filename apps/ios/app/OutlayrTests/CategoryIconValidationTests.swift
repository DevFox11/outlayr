//
//  CategoryIconValidationTests.swift
//  OutlayrTests
//
//  Pins duplicate/missing-icon validation for category creation and editing.
//  The uniqueness pool is flat per income flag: subcategories share it with
//  top-level categories, and the two flags never collide with each other.
//

import CoreData
import XCTest

@testable import Outlayr

final class CategoryIconValidationTests: CharacterizationTestCase {
    private func makeSeededController() -> DataController {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false, order: 0)
        makeCategory(in: context, name: "Salary", icon: "money-bag-01", income: true, order: 0)
        controller.save()
        return controller
    }

    func testDuplicateIconInSamePoolIsRejected() {
        let controller = makeSeededController()

        let result = controller.categoryCheck(name: "Supermarket", icon: "shopping-cart-01", emoji: "", income: false)

        XCTAssertEqual(result.error, .duplicateIcon)
    }

    func testSameIconIsAllowedAcrossIncomeAndExpensePools() {
        let controller = makeSeededController()

        let result = controller.categoryCheck(name: "Refunds", icon: "shopping-cart-01", emoji: "", income: true)

        XCTAssertEqual(result.error, .none)
    }

    func testDuplicateIconAndNameTogetherReportsDuplicate() {
        let controller = makeSeededController()

        let result = controller.categoryCheck(name: "Groceries", icon: "shopping-cart-01", emoji: "", income: false)

        XCTAssertEqual(result.error, .duplicate)
    }

    func testMissingIconIsRejected() {
        let controller = makeSeededController()

        let result = controller.categoryCheck(name: "Travel", icon: "", emoji: "", income: false)

        XCTAssertEqual(result.error, .missingIcon)
    }

    func testMissingIconAndNameReportsIncomplete() {
        let controller = makeSeededController()

        let result = controller.categoryCheck(name: "  ", icon: "", emoji: "", income: false)

        XCTAssertEqual(result.error, .incomplete)
    }

    func testFreshIconIsAccepted() {
        let controller = makeSeededController()

        let result = controller.categoryCheck(name: "Travel", icon: "airplane-01", emoji: "", income: false)

        XCTAssertEqual(result.error, .none)
    }

    func testEditKeepingOwnIconIsAllowed() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let groceries = makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false, order: 0)
        controller.save()

        let result = controller.categoryCheckEdit(name: "Groceries", icon: "shopping-cart-01", emoji: "", toEdit: groceries)

        XCTAssertEqual(result.error, .none)
    }

    func testEditTakingASiblingIconIsRejected() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let groceries = makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false, order: 0)
        makeCategory(in: context, name: "Travel", icon: "airplane-01", income: false, order: 1)
        controller.save()

        let result = controller.categoryCheckEdit(name: "Groceries", icon: "airplane-01", emoji: "", toEdit: groceries)

        XCTAssertEqual(result.error, .duplicateIcon)
    }

    // Two categories with no stored icon both *render* the fallback glyph, but they
    // share no stored value — comparing resolved names here fabricated collisions.
    func testCategoriesWithoutIconsDoNotCollide() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        makeCategory(in: context, name: "Sailboat Fund", icon: nil, income: false, order: 0)
        let wedding = makeCategory(in: context, name: "Wedding Fund", icon: nil, income: false, order: 1)
        controller.save()

        let result = controller.categoryCheckEdit(name: "Wedding Fund", icon: "", emoji: "", toEdit: wedding)

        XCTAssertEqual(result.error, .none)
    }

    func testExplicitDuplicateRawIconsStillCollide() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false, order: 0)
        controller.save()

        let result = controller.categoryCheck(name: "Market", icon: "shopping-cart-01", emoji: "", income: false)

        XCTAssertEqual(result.error, .duplicateIcon)
    }

    // A legacy category must stay editable without being forced to pick an icon.
    func testEditAllowsEmptyIconWhenStoredIconWasNil() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let legacy = makeCategory(in: context, name: "Sailboat Fund", icon: nil, income: false, order: 0)
        controller.save()

        let result = controller.categoryCheckEdit(name: "Sailboat Renamed", icon: "", emoji: "", toEdit: legacy)

        XCTAssertEqual(result.error, .none)
    }

    func testEditStillRejectsEmptyIconWhenOneWasStored() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let groceries = makeCategory(in: context, name: "Groceries", icon: "shopping-cart-01", income: false, order: 0)
        controller.save()

        let result = controller.categoryCheckEdit(name: "Groceries", icon: "", emoji: "", toEdit: groceries)

        XCTAssertEqual(result.error, .missingIcon)
    }

    // A name from a newer version must round-trip untouched rather than being
    // collapsed into the fallback it happens to render as.
    func testUnknownButNonEmptyIconIsAcceptedOnEdit() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let future = makeCategory(in: context, name: "Garage", icon: "car-02-from-a-newer-version", income: false, order: 0)
        controller.save()

        let result = controller.categoryCheckEdit(name: "Garage", icon: "car-02-from-a-newer-version", emoji: "", toEdit: future)

        XCTAssertEqual(result.error, .none)
    }

    func testSubcategorySharesTheIconPoolWithTopLevelCategories() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let parent = makeCategory(in: context, name: "Food", icon: "restaurant-01", income: false, order: 0)
        let child = makeCategory(in: context, name: "Coffee", icon: "coffee-02", income: false, order: 1)
        child.parent = parent
        controller.save()

        let result = controller.categoryCheck(name: "Cafes", icon: "coffee-02", emoji: "", income: false)

        XCTAssertEqual(result.error, .duplicateIcon)
    }

    // The suite covers the symbol contract now, not just icons: the emoji path must
    // hit the same gates with its own error case.
    func testDuplicateEmojiReportsTheEmojiError() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let sailing = makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        sailing.emoji = "⛵️"
        controller.save()

        let result = controller.categoryCheck(name: "Boats", icon: "", emoji: "⛵️", income: false)
        XCTAssertEqual(result.error, .duplicateEmoji)
    }

    func testDuplicateNameAndEmojiReportsTheCombinedError() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let sailing = makeCategory(in: context, name: "Sailing", icon: nil, income: false)
        sailing.emoji = "⛵️"
        controller.save()

        let result = controller.categoryCheck(name: "Sailing", icon: "", emoji: "⛵️", income: false)
        XCTAssertEqual(result.error, .duplicate)
    }

    func testEmojiOnlyCategoryPassesTheSymbolGate() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())

        let result = controller.categoryCheck(name: "Sailing", icon: "", emoji: "⛵️", income: false)
        XCTAssertEqual(result.error, .none)
    }
}
