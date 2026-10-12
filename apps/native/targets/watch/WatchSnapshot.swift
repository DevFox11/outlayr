import Foundation

struct WatchSnapshot: Codable {
    struct Budget: Codable {
        let present: Bool
        let endsAt: Double?
        let isOverall: Bool
        let name: String
        let periodLabel: String
        let remaining: String
        let remainingCaption: String
        let percent: String
        let spentFraction: Double
        let elapsedFraction: Double
        let over: Bool

        func isCurrent(at now: Double) -> Bool {
            present && now < endsAt ?? .infinity
        }

        func elapsed(at now: Double, publishedAt: Double) -> Double {
            guard let endsAt, elapsedFraction < 1 else { return elapsedFraction }
            return 1 - (endsAt - now) / ((endsAt - publishedAt) / (1 - elapsedFraction))
        }
    }

    struct Applied: Codable {
        let ids: [String]
        let since: Double
    }

    struct Entry: Codable, Identifiable {
        let id: String
        let amount: String
        let at: Double?
        let category: String?
        let color: String
        let date: String?
        let day: String
        let emoji: String
        let income: Bool
        let note: String
        let rootCategoryId: String?
        let writeId: String?
    }

    struct Category: Codable, Identifiable {
        let id: String
        let name: String
        let emoji: String
        let color: String
        let income: Bool
    }

    struct Money: Codable {
        let cents: Bool?
        let decimal: String
        let group: String
        let minorUnits: Int
        let symbol: String

        var scale: Int { Int(pow(10.0, Double(minorUnits))) }

        func grouped(_ whole: String) -> String {
            var result = ""
            for (index, digit) in whole.reversed().enumerated() {
                if index > 0, index % 3 == 0 { result.append(contentsOf: group.reversed()) }
                result.append(digit)
            }
            return String(result.reversed())
        }

        func format(units: Int) -> String {
            guard cents ?? true else { return symbol + grouped(String((units + scale / 2) / scale)) }
            let integer = grouped(String(units / scale))
            guard minorUnits > 0 else { return symbol + integer }
            let fraction = String(format: "%0\(minorUnits)d", units % scale)
            return symbol + integer + decimal + fraction
        }
    }

    struct Labels: Codable {
        let all: String?
        let average: String?
        let empty: String
        let income: String
        let recent: String
        let spent: String
        let week: String?
        let yesterday: String?
    }

    struct Week: Codable {
        struct Day: Codable {
            let label: String
            let value: Double
        }

        let average: String
        let days: [Day]

        func addingToday(_ value: Double) -> Week {
            guard let today = days.last, value > 0 else { return self }
            return Week(average: average, days: Array(days.dropLast()) + [Day(label: today.label, value: today.value + value)])
        }
    }

    let applied: Applied?
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
    let week: Week?

    var isFromToday: Bool {
        Calendar.current.isDateInToday(Date(timeIntervalSince1970: publishedAt / 1000))
    }
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
