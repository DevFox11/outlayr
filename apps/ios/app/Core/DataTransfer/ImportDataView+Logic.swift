import CoreData
import Foundation
import SwiftUI
import UIKit

private struct CSVImportError: Error {
    let message: String
}

extension ImportDataView {
    func importData() {
        Task {
            await performImport()
        }
    }

    private func performImport() async {
        let categoryColumnIndex = selectedColumns[0]
        let noteColumnIndex = selectedColumns[1]
        let dateColumnIndex = selectedColumns[2]
        let amountColumnIndex = selectedColumns[3]
        let format = dateFormatString
        let snapshot = rows

        let categoryIncomeMap: [String: Bool] = Dictionary(
            uniqueKeysWithValues: uniqueCategories.compactMap { mc -> (String, Bool)? in
                guard let cat = mc.category else { return nil }
                return (mc.excelValue, cat.income)
            }
        )

        struct ParsedRow: Sendable {
            let note: String
            let categoryKey: String
            let income: Bool
            let amount: Double
            let date: Date
        }

        let result: Result<[ParsedRow], CSVImportError> = await Task.detached(priority: .userInitiated) {
            let formatter = DateFormatter()
            formatter.dateFormat = format
            var out: [ParsedRow] = []
            out.reserveCapacity(snapshot.count)
            for row in snapshot {
                guard let date = formatter.date(from: row[dateColumnIndex]) else {
                    return .failure(CSVImportError(message: "Invalid dates in date column."))
                }
                guard let income = categoryIncomeMap[row[categoryColumnIndex]] else {
                    return .failure(CSVImportError(message: "Error occurred while matching categories."))
                }
                guard let amount = Double(row[amountColumnIndex]) else {
                    return .failure(CSVImportError(message: "Invalid values in amount column."))
                }
                out.append(ParsedRow(
                    note: row[noteColumnIndex],
                    categoryKey: row[categoryColumnIndex],
                    income: income,
                    amount: abs(amount),
                    date: date
                ))
            }
            return .success(out)
        }.value

        switch result {
        case .failure(let error):
            processingState = .error
            errorMessage = error.message

        case .success(let parsedRows):
            let context = dataController.container.viewContext
            let categoryDictionary: [String: Category] = Dictionary(
                uniqueKeysWithValues: uniqueCategories.compactMap { mc -> (String, Category)? in
                    guard let cat = mc.category else { return nil }
                    return (mc.excelValue, cat)
                }
            )

            for row in parsedRows {
                guard let category = categoryDictionary[row.categoryKey] else {
                    context.rollback()
                    processingState = .error
                    errorMessage = "Error occurred while matching categories."
                    return
                }
                _ = dataController.transactions.newTransaction(
                    note: row.note,
                    category: category,
                    income: row.income,
                    amount: row.amount,
                    date: row.date,
                    repeatType: 0,
                    repeatCoefficient: 1,
                    delay: false
                )
            }

            do {
                try dataController.save()
                withAnimation {
                    processingState = .success
                    confettiNumber += 1
                }
            } catch {
                context.rollback()
                processingState = .error
                errorMessage = "Failed to save transactions."
            }
        }
    }

    func validateDoubles(strings: [String]) -> Bool {
        strings.allSatisfy { Double($0) != nil }
    }

    func processCSV() {
        guard data.containsDigits else {
            showToast = true
            toastMessage = "Invalid File"
            return
        }

        var holdingRows = data.components(separatedBy: .newlines).filter { $0 != "" }

        if !holdingRows[0].containsDigits {
            holdingRows.removeFirst()
        }

        guard !holdingRows.isEmpty else {
            showToast = true
            toastMessage = "Invalid File"
            return
        }

        let values = holdingRows.map { $0.components(separatedBy: ",") }.filter { !$0.isEmpty }

        rows = values

        let maxColumnCount = values.map { $0.count }.max() ?? 0

        guard maxColumnCount > 3 else {
            showToast = true
            toastMessage = "Invalid File"
            return
        }

        var holdingColumns: [[String]] = Array(repeating: [], count: maxColumnCount)

        for row in values {
            for (index, value) in row.enumerated() {
                holdingColumns[index].append(value)
            }
        }

        columns = holdingColumns
        displayedColumns = holdingColumns.map { $0.prefix(8).map { $0 } }
        numberOfRows = displayedColumns[0].count
        remainingColumns = Array(0 ..< maxColumnCount)

        withAnimation {
            progress += 1
        }
    }

    func deduceDateFormat(from dateString: String) -> String? {
        let dateFormats = ["yyyy-MM-dd", "dd-MM-yyyy", "MM-dd-yyyy",
                           "yyyy/MM/dd", "dd/MM/yyyy", "MM/dd/yyyy",
                           "yyyyMMdd", "ddMMyyyy", "MMddyyyy", "yyyy-MM-dd HH:mm:ss Z",
                           "dd/MM/yyyy HH:mm:ss"]

        let dateFormatter = DateFormatter()

        for dateFormat in dateFormats {
            dateFormatter.dateFormat = dateFormat
            if dateFormatter.date(from: dateString) != nil {
                return dateFormat
            }
        }

        return nil
    }

    func makeAttributedString() -> AttributedString {
        var string = AttributedString("this article")
        string.foregroundColor = Color.PrimaryText
        string.link = URL(string: "https://pro.arcgis.com/en/pro-app/latest/help/mapping/time/convert-string-or-numeric-time-values-into-data-format.htm")
        string.underlineColor = UIColor(Color.PrimaryText)
        string.underlineStyle = .single
        return string
    }

    @ViewBuilder
    func PointerView(number: Int, text: String) -> some View {
        HStack(alignment: .top, spacing: 15) {
            ZStack {
                Circle()
                    .fill(Color.SecondaryBackground)

                Text("\(number)")
                    .font(.system(.body, design: .rounded).weight(.bold))
                    .foregroundStyle(Color.SubtitleText)
            }
            .frame(width: 25, height: 25)

            Text(text)
                .font(.system(.body, design: .rounded).weight(.medium))
                .foregroundStyle(Color.PrimaryText)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
