//
//  TransactionFormDraft.swift
//  Outlayr
//
//  The in-flight state of the add/edit transaction form as a value type, so the
//  save rules — note fallback, day/month derivation, amount boundary conversion,
//  per-transaction currency, identity write, and recurrence mapping — live
//  outside the view and are unit-testable. `apply(to:category:calendar:)` writes
//  every field except the recurrence back-fill, which needs the DataController;
//  `writesRecurrence` tells the caller whether to run that engine afterwards.
//

import CoreData
import Foundation

struct TransactionFormDraft: Equatable {
    var identity = TransactionIdentitySelection()
    var name = ""
    var income = false
    var amount: Decimal = 0
    var currency: String?
    var isSubscription = false
    /// A `RecurringCadence` raw value (daily/weekly/monthly/yearly). Only
    /// consulted when `isSubscription`.
    var recurringType = 3
    var recurringCoefficient = 1
    var date = Date.now
    var hasEndDate = false
    var endDate = Date.now

    /// The amount gate. Category presence is enforced separately by the view
    /// (it owns the managed object) so the missing-category shake can still fire.
    var canSave: Bool { amount > 0 }

    /// Whether the caller must run the recurrence back-fill engine after saving.
    /// `apply(to:)` always writes the recurrence *fields*; this only gates the
    /// engine call that generates missed occurrences.
    var needsRecurrenceBackfill: Bool { isSubscription }

    /// Writes the draft onto a managed transaction under a fixed category. Does
    /// not persist and does not run the recurrence back-fill. Returns nothing;
    /// the caller saves and, when `needsRecurrenceBackfill`, advances the recurrence.
    func apply(to transaction: Transaction, category: Category, calendar: Calendar = Calendar(identifier: .gregorian)) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        transaction.note = trimmed.isEmpty ? category.wrappedName : trimmed
        transaction.category = category
        transaction.income = income
        transaction.amount = NSDecimalNumber(decimal: amount).doubleValue
        transaction.currency = currency
        transaction.date = date

        transaction.day = calendar.date(bySettingHour: 0, minute: 0, second: 0, of: date) ?? date
        transaction.month = calendar.date(from: calendar.dateComponents([.month, .year], from: date)) ?? date

        identity.apply(to: transaction)

        if isSubscription {
            transaction.onceRecurring = true
            transaction.recurringType = Int16(recurringType)
            transaction.recurringCoefficient = Int16(max(1, recurringCoefficient))
            transaction.recurringEndDate = hasEndDate ? endDate : nil
        } else {
            transaction.onceRecurring = false
            transaction.recurringType = 0
            transaction.recurringCoefficient = 0
            transaction.recurringEndDate = nil
        }
    }

    /// Seeds a draft from an existing transaction for the edit path.
    static func from(_ transaction: Transaction) -> TransactionFormDraft {
        var draft = TransactionFormDraft()
        draft.identity = TransactionIdentitySelection(transaction: transaction)
        draft.name = transaction.wrappedNote
        draft.income = transaction.income
        draft.amount = Decimal(transaction.amount)
        draft.currency = transaction.wrappedCurrency
        draft.date = transaction.date ?? .now
        let type = Int(transaction.recurringType)
        if type > 0 {
            draft.isSubscription = true
            draft.recurringType = type
            draft.recurringCoefficient = max(1, Int(transaction.recurringCoefficient))
        }
        if let end = transaction.recurringEndDate {
            draft.hasEndDate = true
            draft.endDate = end
        }
        return draft
    }
}
