import Foundation

struct WatchSnapshot: Codable {
    struct Budget: Codable {
        let present: Bool
        let isOverall: Bool
        let name: String
        let periodLabel: String
        let remaining: String
        let remainingCaption: String
        let percent: String
        let spentFraction: Double
        let elapsedFraction: Double
        let over: Bool
    }

    struct Entry: Codable, Identifiable {
        let id: String
        let amount: String
        let color: String
        let day: String
        let emoji: String
        let income: Bool
        let note: String
    }

    struct Category: Codable, Identifiable {
        let id: String
        let name: String
        let emoji: String
        let color: String
        let income: Bool
    }

    struct Money: Codable {
        let decimal: String
        let group: String
        let minorUnits: Int
        let symbol: String

        var scale: Int { Int(pow(10.0, Double(minorUnits))) }

        func format(units: Int) -> String {
            let whole = String(units / scale)
            var grouped = ""
            for (index, digit) in whole.reversed().enumerated() {
                if index > 0, index % 3 == 0 { grouped.append(group) }
                grouped.append(digit)
            }
            let integer = String(grouped.reversed())
            guard minorUnits > 0 else { return symbol + integer }
            let fraction = String(format: "%0\(minorUnits)d", units % scale)
            return symbol + integer + decimal + fraction
        }
    }

    struct Labels: Codable {
        let done: String
        let empty: String
        let expense: String
        let income: String
        let log: String
        let logged: String
        let next: String
        let note: String
        let recent: String
        let spent: String
    }

    let currency: String
    let dateLabel: String
    let todayLabel: String
    let todaySpent: String
    let zeroSpent: String
    let budget: Budget
    let entries: [Entry]
    let categories: [Category]
    let labels: Labels
    let money: Money
    let publishedAt: Double
}

struct WatchWrite: Codable {
    let id: String
    let amount: Double
    let income: Bool
    let note: String
    let category: String
    let categoryId: String
    let date: Double

    var message: [String: Any] {
        [
            "type": "log",
            "write": [
                "id": id,
                "amount": amount,
                "income": income,
                "note": note,
                "category": category,
                "categoryId": categoryId,
                "date": date,
            ],
        ]
    }
}
