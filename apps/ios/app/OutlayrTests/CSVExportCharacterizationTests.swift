//
//  CSVExportCharacterizationTests.swift
//  OutlayrTests
//
//  Pins the CSV serialization extracted (mechanically) from SettingsView.exportData()
//  into TransactionCSV.export. Uses a fixed UTC instant so the Date column is
//  independent of the pinned TZ.
//

import CoreData
import XCTest

@testable import Outlayr

final class CSVExportCharacterizationTests: CharacterizationTestCase {
    func testExportProducesHeaderAndRows() throws {
        let controller = makeController(now: referenceDate, defaults: makeIsolatedDefaults())
        let context = controller.container.viewContext
        let food = makeCategory(in: context, name: "Food", order: 1)

        let fixedDate = Date(timeIntervalSince1970: 1_700_000_000)

        // Note contains a comma (must be stripped); amount formatted to 2 dp.
        let expense = makeTransaction(
            in: context,
            amount: 3,
            date: fixedDate,
            income: false,
            note: "Milk, Eggs",
            category: food
        )
        let income = makeTransaction(
            in: context,
            amount: 4.5,
            date: fixedDate,
            income: true,
            note: "Salary",
            category: nil
        )

        let csv = TransactionCSV.export([expense, income])
        let lines = csv.split(separator: "\n", omittingEmptySubsequences: false)

        XCTAssertEqual(lines[0], "Date,Note,Amount,Category,Type")
        XCTAssertEqual(lines[1], "\(fixedDate),Milk Eggs,3.00,Food,Expense")
        XCTAssertEqual(lines[2], "\(fixedDate),Salary,4.50,,Income")

        // Header + 2 rows, each row terminated by a newline.
        XCTAssertTrue(csv.hasPrefix(TransactionCSV.header))
        XCTAssertTrue(csv.hasSuffix("\n"))
    }

    func testExportOfNoTransactionsIsHeaderOnly() throws {
        let csv = TransactionCSV.export([])
        XCTAssertEqual(csv, "Date,Note,Amount,Category,Type\n")
    }
}
