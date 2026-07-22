//
//  CSVExportCharacterizationTests.swift
//  OutlayrTests
//
//  Pins the CSV serialization extracted (mechanically) from SettingsView.exportData()
//  into TransactionCSV.export. Uses a fixed UTC instant so the Date column is
//  independent of the pinned TZ.
//

import Foundation
import CoreData
import Testing

@testable import Outlayr

@MainActor
struct CSVExportCharacterizationTests {
    @Test func exportProducesHeaderAndRows() {
        var f = CharacterizationFixture()
        defer { f.cleanup() }
        let controller = f.makeController(now: f.referenceDate, defaults: f.makeIsolatedDefaults())
        let context = controller.container.viewContext
        let food = f.makeCategory(in: context, name: "Food", order: 1)

        let fixedDate = Date(timeIntervalSince1970: 1_700_000_000)

        // Note contains a comma (must be stripped); amount formatted to 2 dp.
        let expense = f.makeTransaction(
            in: context,
            amount: 3,
            date: fixedDate,
            income: false,
            note: "Milk, Eggs",
            category: food
        )
        let income = f.makeTransaction(
            in: context,
            amount: 4.5,
            date: fixedDate,
            income: true,
            note: "Salary",
            category: nil
        )

        let csv = TransactionCSV.export([expense, income])
        let lines = csv.split(separator: "\n", omittingEmptySubsequences: false)

        #expect(lines[0] == "Date,Note,Amount,Category,Type")
        #expect(lines[1] == "\(fixedDate),Milk Eggs,3.00,Food,Expense")
        #expect(lines[2] == "\(fixedDate),Salary,4.50,,Income")

        // Header + 2 rows, each row terminated by a newline.
        #expect(csv.hasPrefix(TransactionCSV.header))
        #expect(csv.hasSuffix("\n"))
    }

    @Test func exportOfNoTransactionsIsHeaderOnly() {
        let csv = TransactionCSV.export([])
        #expect(csv == "Date,Note,Amount,Category,Type\n")
    }
}
