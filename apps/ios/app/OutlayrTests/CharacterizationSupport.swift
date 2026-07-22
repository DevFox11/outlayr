//
//  CharacterizationSupport.swift
//  OutlayrTests
//
//  Shared infrastructure for the B3 characterization suite. These tests pin the
//  CURRENT behavior of the highest-blast-radius logic so later slices (dependency
//  purge, identifier rename) can be verified as behavior-preserving.
//
//  Determinism strategy (design D3):
//   - The scheme's Test action pins `TZ` so `TimeZone.current` — and therefore
//     `Calendar.current`, which the entity-side date math in Helper.swift uses —
//     is stable across machines.
//   - Every controller is built in-memory with an injected frozen clock and an
//     injected, isolated `UserDefaults` suite. The real app-group suite is never
//     force-unwrapped or mutated by these tests.
//   - The injected calendar is `Calendar.current` (design constraint: it must
//     equal `Calendar.current` so controller-side and entity-side math never mix
//     calendars). Fixtures set `date`/`day`/`startDate` non-nil.
//

import CoreData
import Foundation
import Testing

@testable import Outlayr

@MainActor
struct CharacterizationFixture {
    private var createdSuiteNames: [String] = []

    /// Frozen reference "now" shared by the suite: 2024-06-15 12:00 in the pinned TZ.
    var referenceDate: Date { date(2024, 6, 15, 12, 0) }

    /// Removes all isolated UserDefaults suites created during the test.
    /// Call via `defer { f.cleanup() }` in tests that call `makeIsolatedDefaults()`.
    mutating func cleanup() {
        for name in createdSuiteNames {
            UserDefaults(suiteName: name)?.removePersistentDomain(forName: name)
        }
        createdSuiteNames.removeAll()
    }

    /// An isolated, uniquely-named UserDefaults suite. Never the real app-group suite.
    mutating func makeIsolatedDefaults(firstWeekday: Int = 1, firstDayOfMonth: Int = 1, currency: String = "USD") -> UserDefaults {
        let name = "test.characterization.\(UUID().uuidString)"
        createdSuiteNames.append(name)
        guard let defaults = UserDefaults(suiteName: name) else {
            fatalError("Failed to create isolated UserDefaults suite: \(name)")
        }
        defaults.set(firstWeekday, forKey: "firstWeekday")
        defaults.set(firstDayOfMonth, forKey: "firstDayOfMonth")
        // Pinned so currency bucketing never depends on the machine's locale.
        defaults.set(currency, forKey: DefaultsKey.currency)
        return defaults
    }

    /// In-memory DataController with a frozen clock and isolated defaults.
    func makeController(now: Date, defaults: UserDefaults) -> DataController {
        DataController(inMemory: true, now: { now }, calendar: .current, sharedDefaults: defaults)
    }

    func date(_ year: Int, _ month: Int, _ day: Int, _ hour: Int = 0, _ minute: Int = 0) -> Date {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        components.hour = hour
        components.minute = minute
        components.second = 0
        guard let value = Calendar.current.date(from: components) else {
            fatalError("Invalid date components: \(year)-\(month)-\(day)")
        }
        return value
    }

    @discardableResult
    func makeCategory(
        in context: NSManagedObjectContext,
        name: String,
        icon: String? = "sale-tag-01",
        income: Bool = false,
        order: Int64 = 0
    ) -> Outlayr.Category {
        let category = Outlayr.Category(context: context)
        category.id = UUID()
        category.name = name
        category.icon = icon
        category.color = "#000000"
        category.income = income
        category.order = order
        category.dateCreated = referenceDate
        return category
    }

    @discardableResult
    func makeTransaction(
        in context: NSManagedObjectContext,
        amount: Double,
        date: Date,
        income: Bool = false,
        note: String = "",
        category: Outlayr.Category? = nil,
        recurringType: Int16 = 0,
        recurringCoefficient: Int16 = 0,
        onceRecurring: Bool = false
    ) -> Transaction {
        let transaction = Transaction(context: context)
        transaction.id = UUID()
        transaction.amount = amount
        transaction.date = date
        transaction.day = date
        transaction.month = date
        transaction.income = income
        transaction.note = note
        transaction.category = category
        transaction.recurringType = recurringType
        transaction.recurringCoefficient = recurringCoefficient
        transaction.onceRecurring = onceRecurring
        return transaction
    }

    @discardableResult
    func makeBudget(
        in context: NSManagedObjectContext,
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
        in context: NSManagedObjectContext,
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
