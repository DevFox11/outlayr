//
//  RepositoryTestSupport.swift
//  OutlayrTests
//
//  Shared helpers for Swift Testing repository tests. Not an XCTestCase subclass,
//  so these can be used directly from @Suite structs.
//

import CoreData
import Foundation
@testable import Outlayr

/// In-memory Core Data stack with an injected frozen clock and isolated UserDefaults.
@MainActor
struct RepositoryFixture {
    let controller: DataController
    var context: NSManagedObjectContext { controller.container.viewContext }

    static let referenceDate = testDate(2024, 6, 15, 12, 0)

    init(
        now: Date = referenceDate,
        firstWeekday: Int = 1,
        firstDayOfMonth: Int = 1
    ) {
        let suiteName = "test.repo.\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            fatalError("Failed to create isolated UserDefaults: \(suiteName)")
        }
        defaults.set(firstWeekday, forKey: "firstWeekday")
        defaults.set(firstDayOfMonth, forKey: "firstDayOfMonth")
        self.controller = DataController(inMemory: true, now: { now }, calendar: .current, sharedDefaults: defaults)
    }

    func save() {
        try? controller.save()
    }

    @discardableResult
    func makeCategory(
        name: String,
        icon: String? = "sale-tag-01",
        income: Bool = false,
        order: Int64 = 0
    ) -> Outlayr.Category {
        let cat = Outlayr.Category(context: context)
        cat.id = UUID()
        cat.name = name
        cat.icon = icon
        cat.color = "#000000"
        cat.income = income
        cat.order = order
        cat.dateCreated = Self.referenceDate
        return cat
    }

    @discardableResult
    func makeTransaction(
        amount: Double,
        date: Date,
        income: Bool = false,
        note: String = "",
        category: Outlayr.Category? = nil
    ) -> Transaction {
        let txn = Transaction(context: context)
        txn.id = UUID()
        txn.amount = amount
        txn.date = date
        txn.day = date
        txn.month = date
        txn.income = income
        txn.note = note
        txn.category = category
        return txn
    }

    @discardableResult
    func makeBudget(
        amount: Double,
        startDate: Date,
        type: Int16,
        category: Outlayr.Category? = nil
    ) -> Budget {
        let budget = Budget(context: context)
        budget.id = UUID()
        budget.amount = amount
        budget.startDate = startDate
        budget.type = type
        budget.category = category
        budget.dateCreated = startDate
        return budget
    }

    @discardableResult
    func makeMainBudget(
        amount: Double,
        startDate: Date,
        type: Int16
    ) -> MainBudget {
        let budget = MainBudget(context: context)
        budget.amount = amount
        budget.startDate = startDate
        budget.type = type
        budget.dateCreated = startDate
        return budget
    }
}

/// Builds a `Date` from calendar components. Fatals on invalid input to keep
/// test fixtures readable — a bad date in a test is always a bug, never an edge case.
func testDate(_ year: Int, _ month: Int, _ day: Int, _ hour: Int = 0, _ minute: Int = 0) -> Date {
    var c = DateComponents()
    c.year = year; c.month = month; c.day = day; c.hour = hour; c.minute = minute; c.second = 0
    guard let date = Calendar.current.date(from: c) else {
        fatalError("Invalid test date: \(year)-\(month)-\(day)")
    }
    return date
}
