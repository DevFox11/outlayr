//
//  TransactionFormDraftTests.swift
//  OutlayrTests
//
//  The save rules of the add/edit transaction form, exercised through the pure
//  `TransactionFormDraft` value type (the view only wires it up). Covers the
//  create write-path, the edit round-trip, validation gating, and the
//  category-fetch ordering/hierarchy contract the form's picker relies on.
//

import Foundation
import CoreData
import Testing
@testable import Outlayr

@MainActor
struct TransactionFormDraftTests {
    let fixture: CharacterizationFixture
    let controller: DataController
    var context: NSManagedObjectContext { controller.container.viewContext }

    init() {
        var tmp = CharacterizationFixture()
        let defaults = tmp.makeIsolatedDefaults()
        self.controller = tmp.makeController(now: tmp.referenceDate, defaults: defaults)
        self.fixture = tmp
    }

    // MARK: - Create write-path

    @Test func createWritesIdentityCurrencyAndRecurrence() throws {
        let category = fixture.makeCategory(in: context, name: "Streaming", order: 1)
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

        #expect(transaction.note == "Netflix")
        #expect(transaction.category == category)
        #expect(abs(transaction.amount - 15.99) < 0.0001)
        #expect(transaction.currency == "JPY")
        #expect(transaction.emoji == "🍿")
        #expect(transaction.icon == nil)
        #expect(transaction.imageData == nil)
        #expect(transaction.onceRecurring)
        #expect(transaction.recurringType == 3)
        #expect(transaction.recurringCoefficient == 2)
        #expect(transaction.recurringEndDate == nil)
    }

    @Test func detailsWrittenAndEmptyMapsToNil() {
        let category = fixture.makeCategory(in: context, name: "Streaming", order: 1)

        var withNotes = TransactionFormDraft()
        withNotes.amount = 10
        withNotes.details = "  Split with Alex\nmonthly  "
        let t1 = Transaction(context: context)
        withNotes.apply(to: t1, category: category)
        #expect(t1.details == "Split with Alex\nmonthly")

        var blankNotes = TransactionFormDraft()
        blankNotes.amount = 10
        blankNotes.details = "   \n  "
        let t2 = Transaction(context: context)
        blankNotes.apply(to: t2, category: category)
        #expect(t2.details == nil, "whitespace-only notes map to nil")
    }

    @Test func detailsRoundTripsOnEdit() {
        let category = fixture.makeCategory(in: context, name: "Streaming", order: 1)
        let original = Transaction(context: context)
        original.note = "Netflix"
        original.category = category
        original.amount = 15.99
        original.details = "Family plan"

        let draft = TransactionFormDraft.from(original)
        #expect(draft.details == "Family plan")

        let rewritten = Transaction(context: context)
        draft.apply(to: rewritten, category: category)
        #expect(rewritten.details == "Family plan")
    }

    @Test func emptyNameFallsBackToCategoryName() {
        let category = fixture.makeCategory(in: context, name: "Groceries", order: 1)
        var draft = TransactionFormDraft()
        draft.amount = 10
        draft.name = "   "

        let transaction = Transaction(context: context)
        draft.apply(to: transaction, category: category)

        #expect(transaction.note == "Groceries")
    }

    @Test func oneTimeClearsRecurrenceFields() {
        let category = fixture.makeCategory(in: context, name: "Groceries", order: 1)
        var draft = TransactionFormDraft()
        draft.amount = 10
        draft.isSubscription = false
        draft.recurringType = 3

        let transaction = Transaction(context: context)
        transaction.recurringType = 3
        transaction.onceRecurring = true
        draft.apply(to: transaction, category: category)

        #expect(transaction.onceRecurring == false)
        #expect(transaction.recurringType == 0)
        #expect(transaction.recurringCoefficient == 0)
        #expect(transaction.recurringEndDate == nil)
    }

    @Test func subscriptionEndDateWrittenWhenEnabled() {
        let category = fixture.makeCategory(in: context, name: "Gym", order: 1)
        var draft = TransactionFormDraft()
        draft.amount = 30
        draft.isSubscription = true
        draft.recurringType = 4
        draft.hasEndDate = true
        draft.endDate = fixture.date(2027, 1, 1, 0, 0)

        let transaction = Transaction(context: context)
        draft.apply(to: transaction, category: category)

        #expect(transaction.recurringEndDate == fixture.date(2027, 1, 1, 0, 0))
        #expect(transaction.recurringType == 4)
    }

    @Test func dayAndMonthAreDerivedFromDate() {
        let category = fixture.makeCategory(in: context, name: "Groceries", order: 1)
        var draft = TransactionFormDraft()
        draft.amount = 10
        draft.date = fixture.date(2024, 3, 17, 14, 30)

        let transaction = Transaction(context: context)
        draft.apply(to: transaction, category: category)

        #expect(transaction.day == fixture.date(2024, 3, 17, 0, 0))
        #expect(transaction.month == fixture.date(2024, 3, 1, 0, 0))
    }

    @Test func photoIdentityAppliesImageDataAndColor() {
        let category = fixture.makeCategory(in: context, name: "Streaming", order: 1)
        var draft = TransactionFormDraft()
        draft.amount = 10
        draft.identity.selectPhoto(imageData: Data([0x1, 0x2, 0x3]), imageColor: "#3AD6B2")

        let transaction = Transaction(context: context)
        draft.apply(to: transaction, category: category)

        #expect(transaction.imageData == Data([0x1, 0x2, 0x3]))
        #expect(transaction.imageColor == "#3AD6B2")
        #expect(transaction.emoji == nil)
        #expect(transaction.icon == nil)
    }

    // MARK: - Edit round-trip

    @Test func editRoundTripPreservesFields() {
        let category = fixture.makeCategory(in: context, name: "Streaming", order: 1)
        let original = Transaction(context: context)
        original.note = "Spotify"
        original.category = category
        original.amount = 9.99
        original.currency = "EUR"
        original.income = false
        original.date = fixture.date(2024, 6, 1, 8, 0)
        original.emoji = "🎧"
        original.recurringType = 3
        original.recurringCoefficient = 1
        original.recurringEndDate = fixture.date(2025, 6, 1, 0, 0)

        let draft = TransactionFormDraft.from(original)
        #expect(draft.name == "Spotify")
        #expect(draft.amount == Decimal(9.99))
        #expect(draft.currency == "EUR")
        #expect(draft.isSubscription)
        #expect(draft.recurringType == 3)
        #expect(draft.hasEndDate)
        #expect(draft.endDate == fixture.date(2025, 6, 1, 0, 0))
        if case let .emoji(value) = draft.identity.symbol {
            #expect(value == "🎧")
        } else {
            Issue.record("expected emoji identity")
        }

        let rewritten = Transaction(context: context)
        draft.apply(to: rewritten, category: category)
        #expect(rewritten.note == "Spotify")
        #expect(rewritten.currency == "EUR")
        #expect(rewritten.emoji == "🎧")
        #expect(rewritten.recurringType == 3)
        #expect(rewritten.recurringEndDate == fixture.date(2025, 6, 1, 0, 0))
    }

    // MARK: - Validation gating

    @Test func canSaveRequiresPositiveAmount() {
        var draft = TransactionFormDraft()
        draft.amount = 0
        #expect(draft.canSave == false)
        draft.amount = Decimal(string: "0.01")!
        #expect(draft.canSave)
    }

    // MARK: - Category fetch ordering + hierarchy

    @Test func parentFetchIsOrderedAndScopedToModeAndTopLevel() throws {
        let food = fixture.makeCategory(in: context, name: "Food", order: 2)
        let bills = fixture.makeCategory(in: context, name: "Bills", order: 0)
        let travel = fixture.makeCategory(in: context, name: "Travel", order: 1)
        let salary = fixture.makeCategory(in: context, name: "Salary", income: true, order: 0)
        let child = fixture.makeCategory(in: context, name: "Coffee", order: 5)
        child.parent = food
        try context.save()

        let request = Outlayr.Category.transactionPickerFetchRequest(income: false)
        let parents = try context.fetch(request)

        // Ordered by `order`, income-scoped, top-level only (child + income excluded).
        #expect(parents.map(\.wrappedName) == ["Bills", "Travel", "Food"])
        #expect(parents.contains(salary) == false)
        #expect(parents.contains(child) == false)
        #expect(bills.order == 0)
        #expect(travel.order == 1)
    }

    /// The category sheet must let a parent-that-has-children be selected too (the
    /// row selects; the chevron only expands). A parent-with-children is a valid
    /// selection target: it appears in the fetch and assigns like any category.
    @Test func parentWithChildrenIsASelectableTarget() throws {
        let food = fixture.makeCategory(in: context, name: "Food", order: 0)
        let coffee = fixture.makeCategory(in: context, name: "Coffee", order: 1)
        coffee.parent = food
        try context.save()

        let parents = try context.fetch(Outlayr.Category.transactionPickerFetchRequest(income: false))
        let parentWithChildren = try #require(parents.first { $0.hasChildren })
        #expect(parentWithChildren == food)

        var selected: Outlayr.Category?
        selected = parentWithChildren
        #expect(selected == food)
    }
}
