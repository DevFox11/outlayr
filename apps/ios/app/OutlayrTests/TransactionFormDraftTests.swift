//
//  TransactionFormDraftTests.swift
//  OutlayrTests
//
//  The save rules of the add/edit transaction form, exercised through the pure
//  `TransactionFormDraft` value type (the view only wires it up). Covers the
//  create write-path, the edit round-trip, validation gating, and the
//  category-fetch ordering/hierarchy contract the form's picker relies on.
//

import CoreData
import XCTest
@testable import Outlayr

final class TransactionFormDraftTests: CharacterizationTestCase {
    private var controller: DataController!
    private var context: NSManagedObjectContext { controller.container.viewContext }

    override func setUpWithError() throws {
        try super.setUpWithError()
        controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
    }

    override func tearDownWithError() throws {
        controller = nil
        try super.tearDownWithError()
    }

    // MARK: - Create write-path

    func testCreateWritesIdentityCurrencyAndRecurrence() throws {
        let category = makeCategory(in: context, name: "Streaming", order: 1)
        var draft = TransactionFormDraft()
        draft.name = "Netflix"
        draft.amount = Decimal(string: "15.99")!
        draft.currency = "JPY"
        draft.identity.selectEmoji("🍿")
        draft.isSubscription = true
        draft.recurringType = 3
        draft.recurringCoefficient = 2

        let transaction = Transaction(context: context)
        draft.apply(to: transaction, category: category)

        XCTAssertEqual(transaction.note, "Netflix")
        XCTAssertEqual(transaction.category, category)
        XCTAssertEqual(transaction.amount, 15.99, accuracy: 0.0001)
        XCTAssertEqual(transaction.currency, "JPY")
        XCTAssertEqual(transaction.emoji, "🍿")
        XCTAssertNil(transaction.icon)
        XCTAssertNil(transaction.imageData)
        XCTAssertTrue(transaction.onceRecurring)
        XCTAssertEqual(transaction.recurringType, 3)
        XCTAssertEqual(transaction.recurringCoefficient, 2)
        XCTAssertNil(transaction.recurringEndDate)
    }

    func testDetailsWrittenAndEmptyMapsToNil() {
        let category = makeCategory(in: context, name: "Streaming", order: 1)

        var withNotes = TransactionFormDraft()
        withNotes.amount = 10
        withNotes.details = "  Split with Alex\nmonthly  "
        let t1 = Transaction(context: context)
        withNotes.apply(to: t1, category: category)
        XCTAssertEqual(t1.details, "Split with Alex\nmonthly")

        var blankNotes = TransactionFormDraft()
        blankNotes.amount = 10
        blankNotes.details = "   \n  "
        let t2 = Transaction(context: context)
        blankNotes.apply(to: t2, category: category)
        XCTAssertNil(t2.details, "whitespace-only notes map to nil")
    }

    func testDetailsRoundTripsOnEdit() {
        let category = makeCategory(in: context, name: "Streaming", order: 1)
        let original = Transaction(context: context)
        original.note = "Netflix"
        original.category = category
        original.amount = 15.99
        original.details = "Family plan"

        let draft = TransactionFormDraft.from(original)
        XCTAssertEqual(draft.details, "Family plan")

        let rewritten = Transaction(context: context)
        draft.apply(to: rewritten, category: category)
        XCTAssertEqual(rewritten.details, "Family plan")
    }

    func testEmptyNameFallsBackToCategoryName() {
        let category = makeCategory(in: context, name: "Groceries", order: 1)
        var draft = TransactionFormDraft()
        draft.amount = 10
        draft.name = "   "

        let transaction = Transaction(context: context)
        draft.apply(to: transaction, category: category)

        XCTAssertEqual(transaction.note, "Groceries")
    }

    func testOneTimeClearsRecurrenceFields() {
        let category = makeCategory(in: context, name: "Groceries", order: 1)
        var draft = TransactionFormDraft()
        draft.amount = 10
        draft.isSubscription = false
        draft.recurringType = 3

        let transaction = Transaction(context: context)
        transaction.recurringType = 3
        transaction.onceRecurring = true
        draft.apply(to: transaction, category: category)

        XCTAssertFalse(transaction.onceRecurring)
        XCTAssertEqual(transaction.recurringType, 0)
        XCTAssertEqual(transaction.recurringCoefficient, 0)
        XCTAssertNil(transaction.recurringEndDate)
    }

    func testSubscriptionEndDateWrittenWhenEnabled() {
        let category = makeCategory(in: context, name: "Gym", order: 1)
        var draft = TransactionFormDraft()
        draft.amount = 30
        draft.isSubscription = true
        draft.recurringType = 4
        draft.hasEndDate = true
        draft.endDate = date(2027, 1, 1, 0, 0)

        let transaction = Transaction(context: context)
        draft.apply(to: transaction, category: category)

        XCTAssertEqual(transaction.recurringEndDate, date(2027, 1, 1, 0, 0))
        XCTAssertEqual(transaction.recurringType, 4)
    }

    func testDayAndMonthAreDerivedFromDate() {
        let category = makeCategory(in: context, name: "Groceries", order: 1)
        var draft = TransactionFormDraft()
        draft.amount = 10
        draft.date = date(2024, 3, 17, 14, 30)

        let transaction = Transaction(context: context)
        draft.apply(to: transaction, category: category)

        XCTAssertEqual(transaction.day, date(2024, 3, 17, 0, 0))
        XCTAssertEqual(transaction.month, date(2024, 3, 1, 0, 0))
    }

    func testPhotoIdentityAppliesImageDataAndColor() {
        let category = makeCategory(in: context, name: "Streaming", order: 1)
        var draft = TransactionFormDraft()
        draft.amount = 10
        draft.identity.selectPhoto(imageData: Data([0x1, 0x2, 0x3]), imageColor: "#3AD6B2")

        let transaction = Transaction(context: context)
        draft.apply(to: transaction, category: category)

        XCTAssertEqual(transaction.imageData, Data([0x1, 0x2, 0x3]))
        XCTAssertEqual(transaction.imageColor, "#3AD6B2")
        XCTAssertNil(transaction.emoji)
        XCTAssertNil(transaction.icon)
    }

    // MARK: - Edit round-trip

    func testEditRoundTripPreservesFields() {
        let category = makeCategory(in: context, name: "Streaming", order: 1)
        let original = Transaction(context: context)
        original.note = "Spotify"
        original.category = category
        original.amount = 9.99
        original.currency = "EUR"
        original.income = false
        original.date = date(2024, 6, 1, 8, 0)
        original.emoji = "🎧"
        original.recurringType = 3
        original.recurringCoefficient = 1
        original.recurringEndDate = date(2025, 6, 1, 0, 0)

        let draft = TransactionFormDraft.from(original)
        XCTAssertEqual(draft.name, "Spotify")
        XCTAssertEqual(draft.amount, Decimal(9.99))
        XCTAssertEqual(draft.currency, "EUR")
        XCTAssertTrue(draft.isSubscription)
        XCTAssertEqual(draft.recurringType, 3)
        XCTAssertTrue(draft.hasEndDate)
        XCTAssertEqual(draft.endDate, date(2025, 6, 1, 0, 0))
        if case let .emoji(value) = draft.identity.symbol {
            XCTAssertEqual(value, "🎧")
        } else {
            XCTFail("expected emoji identity")
        }

        let rewritten = Transaction(context: context)
        draft.apply(to: rewritten, category: category)
        XCTAssertEqual(rewritten.note, "Spotify")
        XCTAssertEqual(rewritten.currency, "EUR")
        XCTAssertEqual(rewritten.emoji, "🎧")
        XCTAssertEqual(rewritten.recurringType, 3)
        XCTAssertEqual(rewritten.recurringEndDate, date(2025, 6, 1, 0, 0))
    }

    // MARK: - Validation gating

    func testCanSaveRequiresPositiveAmount() {
        var draft = TransactionFormDraft()
        draft.amount = 0
        XCTAssertFalse(draft.canSave)
        draft.amount = Decimal(string: "0.01")!
        XCTAssertTrue(draft.canSave)
    }

    // MARK: - Category fetch ordering + hierarchy

    func testParentFetchIsOrderedAndScopedToModeAndTopLevel() throws {
        let food = makeCategory(in: context, name: "Food", order: 2)
        let bills = makeCategory(in: context, name: "Bills", order: 0)
        let travel = makeCategory(in: context, name: "Travel", order: 1)
        let salary = makeCategory(in: context, name: "Salary", income: true, order: 0)
        let child = makeCategory(in: context, name: "Coffee", order: 5)
        child.parent = food
        try context.save()

        let request = Outlayr.Category.transactionPickerFetchRequest(income: false)
        let parents = try context.fetch(request)

        // Ordered by `order`, income-scoped, top-level only (child + income excluded).
        XCTAssertEqual(parents.map(\.wrappedName), ["Bills", "Travel", "Food"])
        XCTAssertFalse(parents.contains(salary))
        XCTAssertFalse(parents.contains(child))
        XCTAssertEqual(bills.order, 0)
        XCTAssertEqual(travel.order, 1)
    }

    /// The category sheet must let a parent-that-has-children be selected too (the
    /// row selects; the chevron only expands). A parent-with-children is a valid
    /// selection target: it appears in the fetch and assigns like any category.
    func testParentWithChildrenIsASelectableTarget() throws {
        let food = makeCategory(in: context, name: "Food", order: 0)
        let coffee = makeCategory(in: context, name: "Coffee", order: 1)
        coffee.parent = food
        try context.save()

        let parents = try context.fetch(Outlayr.Category.transactionPickerFetchRequest(income: false))
        let parentWithChildren = try XCTUnwrap(parents.first { $0.hasChildren })
        XCTAssertEqual(parentWithChildren, food)

        var selected: Outlayr.Category?
        selected = parentWithChildren
        XCTAssertEqual(selected, food)
    }
}
