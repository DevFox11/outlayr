//
//  RecurringCadence.swift
//  Outlayr
//
//  The single source of truth for a transaction's recurrence cadence, stored in
//  Core Data as `recurringType` (Int16). Every reader — the back-fill engine
//  (DataController), `Transaction.nextTransactionDate`, and the form's schedule
//  picker/labels — derives its behaviour from this enum instead of re-encoding
//  the 0/1/2/3/4 table. NOTE: the legacy numpad editor's `RecurringPickerView`
//  (TransactionView.swift) predates this and has NO yearly case with different
//  offsets; it is intentionally NOT migrated here (out of scope).
//

import Foundation

enum RecurringCadence: Int16, CaseIterable {
    case none = 0
    case daily
    case weekly
    case monthly
    case yearly

    /// The cadences a user can pick (everything except "not recurring").
    static let selectable: [RecurringCadence] = [.daily, .weekly, .monthly, .yearly]

    /// The next occurrence after `date`, or nil for `.none`. The coefficient is
    /// clamped to at least 1 here so a stalled/zero/negative stored value can
    /// never fail to advance the date — the engine's forward-progress guard is a
    /// second line of defence. Weekly advances in days (×7) to match the original
    /// engine arithmetic exactly.
    ///
    /// Month/year addition clamps to the last valid day of the target month:
    /// Jan 31 monthly → Feb 28/29, Feb 29 yearly → Feb 28 in common years. That
    /// drift is intentional Calendar behaviour, not a bug — the anchor lands on
    /// the nearest valid day rather than skipping the period.
    func next(from date: Date, coefficient: Int16, calendar: Calendar) -> Date? {
        let step = max(1, Int(coefficient))
        switch self {
        case .none: return nil
        case .daily: return calendar.date(byAdding: .day, value: step, to: date)
        case .weekly: return calendar.date(byAdding: .day, value: step * 7, to: date)
        case .monthly: return calendar.date(byAdding: .month, value: step, to: date)
        case .yearly: return calendar.date(byAdding: .year, value: step, to: date)
        }
    }

    /// "Daily" / "Weekly" / "Monthly" / "Yearly" for a coefficient of 1.
    var label: String {
        switch self {
        case .none: return "One-time"
        case .daily: return "Daily"
        case .weekly: return "Weekly"
        case .monthly: return "Monthly"
        case .yearly: return "Yearly"
        }
    }

    /// Capitalised interval unit for the custom-schedule segmented control.
    var unitTitle: String {
        switch self {
        case .none, .daily: return "Days"
        case .weekly: return "Weeks"
        case .monthly: return "Months"
        case .yearly: return "Years"
        }
    }

    /// Lowercase plural unit for "Every N months".
    var unitPlural: String {
        switch self {
        case .none, .daily: return "days"
        case .weekly: return "weeks"
        case .monthly: return "months"
        case .yearly: return "years"
        }
    }

    /// A human phrase for a full cadence + coefficient, e.g. "Monthly" or
    /// "Every 3 months".
    func scheduleLabel(coefficient: Int16) -> String {
        let count = max(1, Int(coefficient))
        return count <= 1 ? label : "Every \(count) \(unitPlural)"
    }
}
