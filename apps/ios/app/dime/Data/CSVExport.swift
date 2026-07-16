//
//  CSVExport.swift
//  dime
//
//  Mechanical extraction (B3) of the CSV serialization previously inlined in
//  SettingsView.exportData(). Output is byte-for-byte identical so the export
//  behavior can be pinned by characterization tests.
//

import Foundation

enum TransactionCSV {
    static let header = "Date,Note,Amount,Category,Type\n"

    static func export(_ transactions: [Transaction]) -> String {
        var csvText = header

        for transaction in transactions {
            var string = transaction.wrappedNote
            let type: String

            if transaction.income {
                type = "Income"
            } else {
                type = "Expense"
            }

            string.removeAll(where: { $0 == "," })

            csvText +=
                "\(transaction.wrappedDate),\(string),\(String(format: "%.2f", transaction.wrappedAmount)),\(transaction.category?.wrappedName ?? ""),\(type)\n"
        }

        return csvText
    }
}
