import CoreData
import Foundation

public extension MainBudget {
    var wrappedName: String {
        if let name, !name.isEmpty { return name }
        return String(localized: "Overall Budget")
    }

    var wrappedDate: Date {
        startDate ?? Date.now
    }

    var endDate: Date {
        let base = startDate ?? Date.now
        if type == 1 {
            return Calendar.current.date(byAdding: .day, value: 1, to: base) ?? base
        } else if type == 2 {
            return Calendar.current.date(byAdding: .day, value: 7, to: base) ?? base
        } else if type == 3 {
            return Calendar.current.date(byAdding: .month, value: 1, to: base) ?? base
        } else if type == 4 {
            return Calendar.current.date(byAdding: .year, value: 1, to: base) ?? base
        }
        return base
    }
}
