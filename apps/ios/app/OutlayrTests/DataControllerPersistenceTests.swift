//
//  DataControllerPersistenceTests.swift
//  OutlayrTests
//
//  Characterizes DataController persistence/CRUD against an in-memory store.
//

import CoreData
import XCTest

@testable import Outlayr

final class DataControllerPersistenceTests: CharacterizationTestCase {
    func testInMemoryStoreReportsLoadedState() throws {
        // The C2b fail-loud guard must never misfire on a healthy store: the
        // in-memory path (and, by construction, the resolved app-group path) reports
        // `.loaded`. The unreachable nil-container path is verified on-device (C3.5).
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        XCTAssertEqual(controller.storeState, .loaded)
    }

    func testStoreStateForNilContainerReportsAppGroupUnavailable() {
        // Locks the fail-loud decision directly: a nil app-group container URL (a
        // broken App Groups entitlement / provisioning profile) must refuse the
        // silent per-process fallback store. Pure, so it needs no FileManager or
        // fatal build to exercise the branch the runtime guard can't reach on-sim.
        XCTAssertEqual(DataController.storeState(for: nil), .appGroupUnavailable)
    }

    func testStoreStateForResolvedContainerReportsLoaded() {
        // The complement: any resolved container URL keeps the store `.loaded`, so
        // the guard never misfires on a healthy app group.
        XCTAssertEqual(DataController.storeState(for: URL(fileURLWithPath: "/tmp/x")), .loaded)
    }

    func testNewTransactionPersistsWithDerivedDayAndMonth() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext

        let category = makeCategory(in: context, name: "Food", income: false, order: 1)
        let txDate = date(2024, 3, 9, 14, 30)

        let transaction = controller.transactions.newTransaction(
            note: "Lunch",
            category: category,
            income: false,
            amount: 12.5,
            date: txDate,
            repeatType: 0,
            repeatCoefficient: 0,
            delay: false
        )

        XCTAssertEqual(transaction.note, "Lunch")
        XCTAssertEqual(transaction.amount, 12.5, accuracy: 0.0001)
        XCTAssertEqual(transaction.category, category)
        XCTAssertFalse(transaction.income)

        // day is start-of-day of the transaction date; month is first-of-month.
        XCTAssertEqual(transaction.day, date(2024, 3, 9, 0, 0))
        XCTAssertEqual(transaction.month, date(2024, 3, 1, 0, 0))
        XCTAssertNotNil(transaction.id)

        let stored = controller.results(for: controller.transactions.fetchRequestForExport())
        XCTAssertEqual(stored.count, 1)
        XCTAssertEqual(stored.first, transaction)
    }

    func testEmptyNoteFallsBackToCategoryName() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Transport", order: 1)

        let transaction = controller.transactions.newTransaction(
            note: "   ",
            category: category,
            income: false,
            amount: 3,
            date: date(2024, 3, 9),
            repeatType: 0,
            repeatCoefficient: 0,
            delay: false
        )

        XCTAssertEqual(transaction.note, "Transport")
    }

    func testFetchRequestForExportSortsByDateDescending() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Food", order: 1)

        makeTransaction(in: context, amount: 1, date: date(2024, 1, 1), category: category)
        makeTransaction(in: context, amount: 2, date: date(2024, 3, 1), category: category)
        makeTransaction(in: context, amount: 3, date: date(2024, 2, 1), category: category)
        controller.save()

        let stored = controller.results(for: controller.transactions.fetchRequestForExport())
        let dates = stored.compactMap { $0.date }
        XCTAssertEqual(dates, [date(2024, 3, 1), date(2024, 2, 1), date(2024, 1, 1)])
    }

    func testDeleteAllClearsEveryEntity() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let category = makeCategory(in: context, name: "Food", order: 1)
        makeTransaction(in: context, amount: 10, date: date(2024, 2, 1), category: category)
        makeBudget(in: context, amount: 100, startDate: date(2024, 2, 1), type: 3, category: category)
        makeMainBudget(in: context, amount: 500, startDate: date(2024, 2, 1), type: 3)
        controller.save()

        controller.deleteAll()

        XCTAssertTrue(controller.results(for: Transaction.fetchRequest()).isEmpty)
        XCTAssertTrue(controller.results(for: Outlayr.Category.fetchRequest()).isEmpty)
        XCTAssertTrue(controller.results(for: Budget.fetchRequest()).isEmpty)
        XCTAssertTrue(controller.results(for: MainBudget.fetchRequest()).isEmpty)
    }
}
