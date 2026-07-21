//
//  TransactionRepository.swift
//  Outlayr
//

import CoreData
import Foundation

struct TransactionRepository {
    let dataController: DataController
    private let context: NSManagedObjectContext

    init(dataController: DataController) {
        self.init(dataController: dataController, context: dataController.container.viewContext)
    }

    /// Private because write paths save the view context via `DataController.save()`:
    /// a repository built on a background context must stay read-only, and only the
    /// async overloads below construct one.
    private init(dataController: DataController, context: NSManagedObjectContext) {
        self.dataController = dataController
        self.context = context
    }

    private var now: () -> Date { dataController.now }
    private var injectedCalendar: Calendar { dataController.injectedCalendar }
    private var sharedDefaults: UserDefaults { dataController.sharedDefaults }

    private func results<T: NSManagedObject>(for fetchRequest: NSFetchRequest<T>) -> [T] {
        (try? context.fetch(fetchRequest)) ?? []
    }

    private func save() {
        dataController.save()
    }

    /// The next occurrence date for a recurring transaction's type/coefficient,
    /// resolved through `RecurringCadence` (daily/weekly/monthly/yearly). Returns
    /// nil for an unrecognised type or `.none` so callers stop advancing instead
    /// of force-unwrapping. The coefficient is clamped to ≥1 inside the cadence,
    /// and month/year addition clamps to the last valid day of the month (see
    /// `RecurringCadence.next`).
    private func advanceRecurringDate(from date: Date, type: Int16, coefficient: Int16) -> Date? {
        RecurringCadence(rawValue: type)?.next(from: date, coefficient: coefficient, calendar: injectedCalendar)
    }

    func updateRecurringTransaction(transaction: Transaction) {
        // The recurrence stops after this day (inclusive): occurrences ON the end
        // date are generated, occurrences past it are not. nil means open-ended.
        let endLimit = transaction.recurringEndDate.map { injectedCalendar.startOfDay(for: $0) }
        func withinEndLimit(_ date: Date) -> Bool {
            guard let endLimit else { return true }
            return injectedCalendar.startOfDay(for: date) <= endLimit
        }

        if transaction.nextTransactionDate < injectedCalendar.startOfDay(for: now()) {
            var holdingDate = transaction.nextTransactionDate

            while holdingDate <= injectedCalendar.startOfDay(for: now()), withinEndLimit(holdingDate) {
                let newTransaction = Transaction(context: context)
                newTransaction.note = transaction.wrappedNote
                newTransaction.category = transaction.category
                newTransaction.amount = transaction.wrappedAmount
                newTransaction.date = holdingDate
                newTransaction.id = UUID()
                newTransaction.income = transaction.income
                newTransaction.day = holdingDate

                let calendar = Calendar(identifier: .gregorian)

                let dateComponents = calendar.dateComponents([.month, .year], from: holdingDate)

                newTransaction.month = calendar.date(from: dateComponents)!

                newTransaction.onceRecurring = true

                guard let newDate = advanceRecurringDate(
                    from: holdingDate,
                    type: transaction.recurringType,
                    coefficient: transaction.recurringCoefficient
                ) else {
                    newTransaction.recurringType = 0
                    break
                }

                // Forward-progress invariant: if the advance did not move the
                // date past the current occurrence (a malformed/zero coefficient
                // that survived clamping, or a calendar edge), retire the row
                // rather than loop forever inserting on the same day.
                guard newDate > holdingDate else {
                    newTransaction.recurringType = 0
                    break
                }

                // Carry the recurrence forward only if the next occurrence is both
                // still ahead of today and within the (inclusive) end date.
                if newDate > injectedCalendar.startOfDay(for: now()), withinEndLimit(newDate) {
                    newTransaction.recurringType = transaction.recurringType
                    newTransaction.recurringCoefficient = transaction.recurringCoefficient
                    newTransaction.recurringEndDate = transaction.recurringEndDate
                } else {
                    newTransaction.recurringType = 0
                }

                holdingDate = newDate
            }

            transaction.recurringType = 0

            save()

        } else if injectedCalendar.isDate(transaction.nextTransactionDate, inSameDayAs: now()) {
            // The next occurrence is today. Generate it only if it is within the
            // (inclusive) end date; either way retire the source row — a same-day
            // occurrence past the end date is done, not left lingering.
            if withinEndLimit(transaction.nextTransactionDate) {
                let newTransaction = Transaction(context: context)
                newTransaction.note = transaction.wrappedNote
                newTransaction.category = transaction.category
                newTransaction.amount = transaction.wrappedAmount
                newTransaction.date = transaction.nextTransactionDate
                newTransaction.id = UUID()
                newTransaction.income = transaction.income
                newTransaction.day = transaction.nextTransactionDate

                let calendar = Calendar(identifier: .gregorian)

                let dateComponents = calendar.dateComponents([.month, .year], from: transaction.nextTransactionDate)

                newTransaction.month = calendar.date(from: dateComponents)!

                newTransaction.onceRecurring = true

                // Carry forward only if the occurrence after today is still within the
                // (inclusive) end date; otherwise this is the final occurrence.
                let nextAfter = advanceRecurringDate(
                    from: transaction.nextTransactionDate,
                    type: transaction.recurringType,
                    coefficient: transaction.recurringCoefficient
                )
                if let nextAfter, withinEndLimit(nextAfter) {
                    newTransaction.recurringType = transaction.recurringType
                    newTransaction.recurringCoefficient = transaction.recurringCoefficient
                    newTransaction.recurringEndDate = transaction.recurringEndDate
                } else {
                    newTransaction.recurringType = 0
                }
            }

            transaction.recurringType = 0

            save()
        }
    }

    func updateRecurringTransactions() {
        let recurringTransactions = results(for: fetchRequestForRecurringTransactions())

        recurringTransactions.forEach { transaction in
            updateRecurringTransaction(transaction: transaction)
        }
    }

    func newTransaction(note: String, category: Category?, income: Bool, amount: Double, date: Date, repeatType: Int, repeatCoefficient: Int, delay _: Bool) -> Transaction {
        let transaction = Transaction(context: context)

        if note.trimmingCharacters(in: .whitespacesAndNewlines) == "" {
            transaction.note = category?.wrappedName ?? ""
        } else {
            transaction.note = note.trimmingCharacters(in: .whitespaces)
        }

        transaction.income = income

        if let unwrappedCategory = category {
            transaction.category = unwrappedCategory
        }

        transaction.amount = amount
        transaction.date = date
        transaction.id = UUID()

        let calendar = Calendar(identifier: .gregorian)

        transaction.day = calendar.date(bySettingHour: 0, minute: 0, second: 0, of: date) ?? Date.now

        let dateComponents = calendar.dateComponents([.month, .year], from: date)

        transaction.month = calendar.date(from: dateComponents) ?? Date.now

        if repeatType > 0 {
            transaction.onceRecurring = true
            transaction.recurringType = Int16(repeatType)
            // Clamp defensively so a malformed coefficient can never stall the
            // back-fill loop (mirrors TransactionFormDraft + RecurringCadence).
            transaction.recurringCoefficient = Int16(max(1, repeatCoefficient))
            updateRecurringTransaction(transaction: transaction)
        }

        save()

        return transaction
    }

    func newTemplateTransaction(order: Int) {
        if let match = getTemplateTransaction(order: order) {
            if let unwrappedCategory = match.category {
                _ = newTransaction(note: match.note ?? "", category: unwrappedCategory, income: match.income, amount: match.amount, date: Date.now, repeatType: Int(match.recurringType), repeatCoefficient: Int(match.recurringCoefficient), delay: false)

                dataController.addedTransaction = true
            }
        }
    }

    func fetchRequestForRecurringTransactions() -> NSFetchRequest<Transaction> {
        let itemRequest: NSFetchRequest<Transaction> = Transaction.fetchRequest()
        itemRequest.predicate = NSPredicate(format: "%K > %i", #keyPath(Transaction.recurringType), 0)
        return itemRequest
    }

    func getTemplateTransaction(order: Int) -> TemplateTransaction? {
        let itemRequest: NSFetchRequest<TemplateTransaction> = TemplateTransaction.fetchRequest()

        itemRequest.predicate = NSPredicate(format: "order == %d", order)

        let results = results(for: itemRequest)

        if results.count > 1 {
            let output = results.first

            for i in 1 ..< results.count {
                context.delete(results[i])
            }

            save()

            return output
        } else {
            return results.first
        }
    }

    func getAllTemplateTransactions() -> [TemplateTransaction] {
        let itemRequest: NSFetchRequest<TemplateTransaction> = TemplateTransaction.fetchRequest()

        return results(for: itemRequest)
    }

    func fetchRequestForRecentTransactions(type: TimePeriod) -> NSFetchRequest<Transaction> {
        let itemRequest: NSFetchRequest<Transaction> = Transaction.fetchRequest()

        var calendar = Calendar(identifier: .gregorian)

        calendar.firstWeekday = AppIdentifiers.sharedDefaults!.integer(forKey: "firstWeekday")
        calendar.minimumDaysInFirstWeek = 4

        switch type {
        case .unknown:
            return itemRequest
        case .day:
            let today = calendar.startOfDay(for: Date.now)
            let nextDay = calendar.date(byAdding: .day, value: 1, to: today)!

            let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), today as CVarArg)
            let endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), nextDay as CVarArg)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate])

            itemRequest.predicate = andPredicate
            itemRequest.sortDescriptors = [
                NSSortDescriptor(keyPath: \Transaction.date, ascending: false)
            ]

            return itemRequest
        case .week:
            let dateComponents = calendar.dateComponents([.weekOfYear, .yearForWeekOfYear], from: Date.now)

            let thisWeek = calendar.date(from: dateComponents)!
            let nextWeek = calendar.date(byAdding: .day, value: 7, to: thisWeek)!

            let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), thisWeek as CVarArg)
            let endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), nextWeek as CVarArg)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate])

            itemRequest.predicate = andPredicate
            itemRequest.sortDescriptors = [
                NSSortDescriptor(keyPath: \Transaction.date, ascending: false)
            ]

            return itemRequest
        case .month:
            let dateComponents = calendar.dateComponents([.month, .year], from: Date.now)

            let thisMonth = calendar.date(from: dateComponents)!
            let nextMonth = calendar.date(byAdding: .month, value: 1, to: thisMonth)!

            let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), thisMonth as CVarArg)
            let endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), nextMonth as CVarArg)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate])

            itemRequest.predicate = andPredicate
            itemRequest.sortDescriptors = [
                NSSortDescriptor(keyPath: \Transaction.date, ascending: false)
            ]

            return itemRequest
        case .year:
            let dateComponents = calendar.dateComponents([.year], from: Date.now)

            let thisYear = calendar.date(from: dateComponents)!
            let nextYear = calendar.date(byAdding: .year, value: 1, to: thisYear)!

            let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), thisYear as CVarArg)
            let endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), nextYear as CVarArg)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate])

            itemRequest.predicate = andPredicate
            itemRequest.sortDescriptors = [
                NSSortDescriptor(keyPath: \Transaction.date, ascending: false)
            ]

            return itemRequest
        }
    }

    func fetchRequestForExport() -> NSFetchRequest<Transaction> {
        let itemRequest: NSFetchRequest<Transaction> = Transaction.fetchRequest()
        itemRequest.sortDescriptors = [NSSortDescriptor(key: "date", ascending: false)]
        return itemRequest
    }

    func getSuggestedNotes(searchQuery: String, category: Category?, income: Bool) -> [Transaction] {
        let itemRequest: NSFetchRequest<Transaction> = Transaction.fetchRequest()
        itemRequest.sortDescriptors = [NSSortDescriptor(keyPath: \Transaction.date, ascending: false)]

        let beginPredicate = NSPredicate(format: "%K BEGINSWITH[cd] %@", #keyPath(Transaction.note), searchQuery)
        let containPredicate = NSPredicate(format: "%K CONTAINS[cd] %@", #keyPath(Transaction.note), searchQuery)
        let compound = NSCompoundPredicate(orPredicateWithSubpredicates: [beginPredicate, containPredicate])

        let incomePredicate = NSPredicate(format: "income = %d", income)

        if let unwrappedCategory = category {
            let categoryPredicate = NSPredicate(format: "%K == %@", #keyPath(Transaction.category), unwrappedCategory)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [compound, categoryPredicate, incomePredicate])

            itemRequest.predicate = andPredicate
        } else {
            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [compound, incomePredicate])
            itemRequest.predicate = andPredicate
        }

        let transactions = results(for: itemRequest)

        var seen = [Transaction]()
        let filtered = transactions.filter { entity -> Bool in
            if seen.contains(where: { $0.wrappedNote == entity.wrappedNote }) {
                return false
            } else {
                seen.append(entity)
                return true
            }
        }

        return filtered
    }

    func fetchRequestForLogView(type: Int, optionalIncome: Bool?, categoryFilters: [Category] = []) -> NSFetchRequest<Transaction> {
        let itemRequest: NSFetchRequest<Transaction> = Transaction.fetchRequest()

        var calendar = Calendar(identifier: .gregorian)

        calendar.firstWeekday = AppIdentifiers.sharedDefaults!.integer(forKey: "firstWeekday")
        calendar.minimumDaysInFirstWeek = 4

        let dateCapPredicate = NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)

        // all time
        if type == 5 {
            let andPredicate: NSCompoundPredicate
            let superPredicate: NSCompoundPredicate

            var categoryPredicates = [NSPredicate]()

            for category in categoryFilters {
                categoryPredicates.append(NSPredicate(format: "category == %@ OR category.parent == %@", category, category))
            }

            let categoryCompoundPredicate = NSCompoundPredicate(type: .or, subpredicates: categoryPredicates)

            if let income = optionalIncome {
                let incomePredicate = NSPredicate(format: "income = %d", income)

                andPredicate = NSCompoundPredicate(type: .and, subpredicates: [incomePredicate, dateCapPredicate])

                superPredicate = NSCompoundPredicate(type: .and, subpredicates: [andPredicate, categoryCompoundPredicate])
            } else {
                andPredicate = NSCompoundPredicate(type: .and, subpredicates: [dateCapPredicate])

                superPredicate = NSCompoundPredicate(type: .and, subpredicates: [andPredicate, categoryCompoundPredicate])
            }

            if categoryFilters.isEmpty {
                itemRequest.predicate = andPredicate
            } else {
                itemRequest.predicate = superPredicate
            }

            return itemRequest
        } else {
            let startPredicate: NSPredicate

            if type == 1 {
                let today = calendar.startOfDay(for: Date.now)
                startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), today as CVarArg)
            } else if type == 2 {
                let dateComponents = calendar.dateComponents([.weekOfYear, .yearForWeekOfYear], from: Date.now)
                let thisWeek = calendar.date(from: dateComponents)!
                startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), thisWeek as CVarArg)
            } else if type == 3 {
                let startOfMonth = AppIdentifiers.sharedDefaults!.integer(forKey: "firstDayOfMonth")

                let thisMonth = getStartOfMonth(startDay: startOfMonth)
                startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), thisMonth as CVarArg)
            } else {
                let dateComponents = calendar.dateComponents([.year], from: Date.now)
                let thisYear = calendar.date(from: dateComponents)!
                startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), thisYear as CVarArg)
            }

            let andPredicate: NSCompoundPredicate
            let superPredicate: NSCompoundPredicate

            var categoryPredicates = [NSPredicate]()

            for category in categoryFilters {
                categoryPredicates.append(NSPredicate(format: "category == %@ OR category.parent == %@", category, category))
            }

            let categoryCompoundPredicate = NSCompoundPredicate(type: .or, subpredicates: categoryPredicates)

            if let income = optionalIncome {
                let incomePredicate = NSPredicate(format: "income = %d", income)

                andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, incomePredicate, dateCapPredicate])

                superPredicate = NSCompoundPredicate(type: .and, subpredicates: [andPredicate, categoryCompoundPredicate])
            } else {
                andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, dateCapPredicate])

                superPredicate = NSCompoundPredicate(type: .and, subpredicates: [andPredicate, categoryCompoundPredicate])
            }

            if categoryFilters.isEmpty {
                itemRequest.predicate = andPredicate
            } else {
                itemRequest.predicate = superPredicate
            }

            return itemRequest
        }
    }

    func getShortcutInsights(type: Int, timeframe: Int, optionalIncome: Bool?, categories: [Category]) -> Double {
        let fetchRequest = fetchRequestForLogView(type: timeframe, optionalIncome: optionalIncome, categoryFilters: categories)
        let allTransactions = results(for: fetchRequest)

        if type == 1 {
            var total = 0.0

            allTransactions.forEach { transaction in
                if transaction.income {
                    total += transaction.amount
                } else {
                    total -= transaction.amount
                }
            }

            return total
        } else {
            var total = 0.0

            allTransactions.forEach { transaction in
                total += transaction.amount
            }

            return total
        }
    }

    func getLogViewTotalSpent(type: Int) -> Double {
        let fetchRequest = fetchRequestForLogView(type: type, optionalIncome: false)
        let allTransactions = results(for: fetchRequest)

        var total = 0.0

        allTransactions.forEach { transaction in
            total += transaction.amount
        }

        return total
    }

    func getLogViewTotalIncome(type: Int) -> Double {
        let fetchRequest = fetchRequestForLogView(type: type, optionalIncome: true)
        let allTransactions = results(for: fetchRequest)

        var total = 0.0

        allTransactions.forEach { transaction in
            total += transaction.amount
        }

        return total
    }

    func getLogViewTotalNet(type: Int) -> (value: Double, positive: Bool) {
        let fetchRequest = fetchRequestForLogView(type: type, optionalIncome: nil)
        let allTransactions = results(for: fetchRequest)

        var total = 0.0

        allTransactions.forEach { transaction in
            if transaction.income {
                total += transaction.amount
            } else {
                total -= transaction.amount
            }
        }

        if total >= 0 {
            return (total, true)
        } else {
            return (abs(total), false)
        }
    }

    func getLineGraphDataNet(type: Int) -> [LineGraphDataPoint] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date.now)

        let fetchRequest = fetchRequestForLineGraph(optionalIncome: nil)
        let transactions = results(for: fetchRequest)

        var holdingDataPoints = [LineGraphDataPoint]()
        var totalForDay = 0.0

        if type < 3 {
            let lastWeek = Calendar.current.date(byAdding: .day, value: -7, to: today)!
            var changingDate = Calendar.current.date(byAdding: .second, value: 86399, to: lastWeek)!

            for transaction in transactions {
                if transaction.wrappedDate < changingDate {
                    if transaction.income {
                        totalForDay += transaction.amount
                    } else {
                        totalForDay -= transaction.amount
                    }
                } else {
                    let newData = LineGraphDataPoint(date: changingDate, amount: totalForDay)
                    holdingDataPoints.append(newData)
                    changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!

                    while transaction.wrappedDate > changingDate {
                        let anotherNewData = LineGraphDataPoint(date: changingDate, amount: totalForDay)
                        holdingDataPoints.append(anotherNewData)
                        changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!
                    }

                    if transaction.income {
                        totalForDay += transaction.amount
                    } else {
                        totalForDay -= transaction.amount
                    }
                }
            }

            let newData = LineGraphDataPoint(date: changingDate, amount: totalForDay)
            holdingDataPoints.append(newData)

            if changingDate < today {
                changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!

                while changingDate < today {
                    let anotherNewData = LineGraphDataPoint(date: changingDate, amount: totalForDay)
                    holdingDataPoints.append(anotherNewData)
                    changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!
                }

                let finalDate = LineGraphDataPoint(date: today, amount: totalForDay)
                holdingDataPoints.append(finalDate)
            }
        } else if type == 3 {
            let lastMonth = Calendar.current.date(byAdding: .month, value: -1, to: today)!
            var changingDate = Calendar.current.date(byAdding: .second, value: 86399, to: lastMonth)!

            for transaction in transactions {
                if transaction.wrappedDate < changingDate {
                    if transaction.income {
                        totalForDay += transaction.amount
                    } else {
                        totalForDay -= transaction.amount
                    }
                } else {
                    let newData = LineGraphDataPoint(date: changingDate, amount: totalForDay)
                    holdingDataPoints.append(newData)
                    changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!

                    while transaction.wrappedDate > changingDate {
                        let anotherNewData = LineGraphDataPoint(date: changingDate, amount: totalForDay)
                        holdingDataPoints.append(anotherNewData)
                        changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!
                    }

                    if transaction.income {
                        totalForDay += transaction.amount
                    } else {
                        totalForDay -= transaction.amount
                    }
                }
            }

            let newData = LineGraphDataPoint(date: changingDate, amount: totalForDay)
            holdingDataPoints.append(newData)

            if changingDate < today {
                changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!

                while changingDate < today {
                    let anotherNewData = LineGraphDataPoint(date: changingDate, amount: totalForDay)
                    holdingDataPoints.append(anotherNewData)
                    changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!
                }

                let finalDate = LineGraphDataPoint(date: today, amount: totalForDay)
                holdingDataPoints.append(finalDate)
            }
        } else if type == 4 {
            let dateComponents = calendar.dateComponents([.month, .year], from: Date.now)
            let thisMonth = calendar.date(from: dateComponents)!
            let nextMonth = calendar.date(byAdding: .month, value: 1, to: thisMonth)!
            var changingDate = calendar.date(byAdding: .year, value: -1, to: nextMonth)!

            for transaction in transactions {
                if transaction.wrappedDate < changingDate {
                    if transaction.income {
                        totalForDay += transaction.amount
                    } else {
                        totalForDay -= transaction.amount
                    }
                } else {
                    let dataDate = calendar.date(byAdding: .day, value: -1, to: changingDate)!
                    let newData = LineGraphDataPoint(date: dataDate, amount: totalForDay)
                    holdingDataPoints.append(newData)
                    changingDate = Calendar.current.date(byAdding: .month, value: 1, to: changingDate)!

                    while transaction.wrappedDate > changingDate {
                        let newDataDate = calendar.date(byAdding: .day, value: -1, to: changingDate)!
                        let anotherNewData = LineGraphDataPoint(date: newDataDate, amount: totalForDay)
                        holdingDataPoints.append(anotherNewData)
                        changingDate = Calendar.current.date(byAdding: .month, value: 1, to: changingDate)!
                    }

                    if transaction.income {
                        totalForDay += transaction.amount
                    } else {
                        totalForDay -= transaction.amount
                    }
                }
            }

            let dataDate = calendar.date(byAdding: .day, value: -1, to: changingDate)!
            let newData = LineGraphDataPoint(date: dataDate, amount: totalForDay)
            holdingDataPoints.append(newData)

            if changingDate < nextMonth {
                changingDate = Calendar.current.date(byAdding: .month, value: 1, to: changingDate)!

                while changingDate < nextMonth {
                    let anotherDataDate = calendar.date(byAdding: .day, value: -1, to: changingDate)!
                    let anotherNewData = LineGraphDataPoint(date: anotherDataDate, amount: totalForDay)
                    holdingDataPoints.append(anotherNewData)
                    changingDate = Calendar.current.date(byAdding: .month, value: 1, to: changingDate)!
                }

                let finalDate = LineGraphDataPoint(date: today, amount: totalForDay)
                holdingDataPoints.append(finalDate)
            }
        }

        return holdingDataPoints
    }

    func getLineGraphData(income: Bool, type: Int) -> [LineGraphDataPoint] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date.now)

        let fetchRequest = fetchRequestForLineGraph(optionalIncome: income)
        let transactions = results(for: fetchRequest)

        var holdingDataPoints = [LineGraphDataPoint]()
        var totalForDay = 0.0

        if type < 3 {
            let lastWeek = Calendar.current.date(byAdding: .day, value: -7, to: today)!
            var changingDate = Calendar.current.date(byAdding: .second, value: 86399, to: lastWeek)!

            for transaction in transactions {
                if transaction.wrappedDate > lastWeek {
                    if transaction.wrappedDate < changingDate {
                        totalForDay += transaction.wrappedAmount
                    } else {
                        let newData = LineGraphDataPoint(date: changingDate, amount: totalForDay)
                        holdingDataPoints.append(newData)
                        changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!
                        totalForDay = 0

                        while transaction.wrappedDate > changingDate {
                            let anotherNewData = LineGraphDataPoint(date: changingDate, amount: 0)
                            holdingDataPoints.append(anotherNewData)
                            changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!
                        }

                        totalForDay += transaction.wrappedAmount
                    }
                }
            }

            let newData = LineGraphDataPoint(date: changingDate, amount: totalForDay)
            holdingDataPoints.append(newData)
            totalForDay = 0

            if changingDate < today {
                changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!

                while changingDate < today {
                    let anotherNewData = LineGraphDataPoint(date: changingDate, amount: 0)
                    holdingDataPoints.append(anotherNewData)
                    changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!
                }

                let finalDate = LineGraphDataPoint(date: today, amount: totalForDay)
                holdingDataPoints.append(finalDate)
            }
        } else if type == 3 {
            let lastMonth = Calendar.current.date(byAdding: .month, value: -1, to: today)!
            var changingDate = Calendar.current.date(byAdding: .second, value: 86399, to: lastMonth)!

            for transaction in transactions {
                if transaction.wrappedDate > lastMonth {
                    if transaction.wrappedDate < changingDate {
                        totalForDay += transaction.wrappedAmount
                    } else {
                        let newData = LineGraphDataPoint(date: changingDate, amount: totalForDay)
                        holdingDataPoints.append(newData)
                        changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!
                        totalForDay = 0

                        while transaction.wrappedDate > changingDate {
                            let anotherNewData = LineGraphDataPoint(date: changingDate, amount: 0)
                            holdingDataPoints.append(anotherNewData)
                            changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!
                        }

                        totalForDay += transaction.wrappedAmount
                    }
                }
            }

            let newData = LineGraphDataPoint(date: changingDate, amount: totalForDay)
            holdingDataPoints.append(newData)

            if changingDate < today {
                changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!

                while changingDate < today {
                    let anotherNewData = LineGraphDataPoint(date: changingDate, amount: 0)
                    holdingDataPoints.append(anotherNewData)
                    changingDate = Calendar.current.date(byAdding: .day, value: 1, to: changingDate)!
                }

                let finalDate = LineGraphDataPoint(date: today, amount: 0)
                holdingDataPoints.append(finalDate)
            }
        } else if type == 4 {
            let dateComponents = calendar.dateComponents([.month, .year], from: Date.now)
            let thisMonth = calendar.date(from: dateComponents)!
            let thisMonthLastYear = calendar.date(byAdding: .year, value: -1, to: thisMonth)!
            let nextMonth = calendar.date(byAdding: .month, value: 1, to: thisMonth)!
            var changingDate = calendar.date(byAdding: .year, value: -1, to: nextMonth)!

            for transaction in transactions {
                if transaction.wrappedDate > thisMonthLastYear {
                    if transaction.wrappedDate < changingDate {
                        totalForDay += transaction.wrappedAmount
                    } else {
                        let dataDate = calendar.date(byAdding: .day, value: -1, to: changingDate)!
                        let newData = LineGraphDataPoint(date: dataDate, amount: totalForDay)
                        holdingDataPoints.append(newData)
                        changingDate = Calendar.current.date(byAdding: .month, value: 1, to: changingDate)!
                        totalForDay = 0

                        while transaction.wrappedDate > changingDate {
                            let newDataDate = calendar.date(byAdding: .day, value: -1, to: changingDate)!
                            let anotherNewData = LineGraphDataPoint(date: newDataDate, amount: 0)
                            holdingDataPoints.append(anotherNewData)
                            changingDate = Calendar.current.date(byAdding: .month, value: 1, to: changingDate)!
                        }

                        totalForDay += transaction.wrappedAmount
                    }
                }
            }

            let dataDate = calendar.date(byAdding: .day, value: -1, to: changingDate)!
            let newData = LineGraphDataPoint(date: dataDate, amount: totalForDay)
            holdingDataPoints.append(newData)

            if changingDate < nextMonth {
                changingDate = Calendar.current.date(byAdding: .month, value: 1, to: changingDate)!

                while changingDate < nextMonth {
                    let anotherDataDate = calendar.date(byAdding: .day, value: -1, to: changingDate)!
                    let anotherNewData = LineGraphDataPoint(date: anotherDataDate, amount: 0)
                    holdingDataPoints.append(anotherNewData)
                    changingDate = Calendar.current.date(byAdding: .month, value: 1, to: changingDate)!
                }

                let finalDate = LineGraphDataPoint(date: today, amount: 0)
                holdingDataPoints.append(finalDate)
            }
        }

        return holdingDataPoints
    }

    func fetchRequestForLineGraph(optionalIncome: Bool?) -> NSFetchRequest<Transaction> {
        let itemRequest: NSFetchRequest<Transaction> = Transaction.fetchRequest()
        itemRequest.sortDescriptors = [NSSortDescriptor(keyPath: \Transaction.date, ascending: true)]

        if let income = optionalIncome {
            itemRequest.predicate = NSPredicate(format: "income = %d", income)
            return itemRequest
        } else {
            return itemRequest
        }
    }

    func fetchRequestForLogViewCategoryFilter(income: Bool) -> NSFetchRequest<Transaction> {
        let itemRequest: NSFetchRequest<Transaction> = Transaction.fetchRequest()
        itemRequest.predicate = NSPredicate(format: "income = %d", income)
        return itemRequest
    }

    func getInsights(type: Int, date: Date, income: Bool) -> (amount: Double, maximum: Double, average: Double, numberOfDays: Int, dates: [Date], dateDictionary: [Date: Double]) {
        let currentItemRequest: NSFetchRequest<Transaction> = fetchRequestForInsights(type: type, date: date, income: income)
        let currentTransactions = results(for: currentItemRequest)

        var iterativeDate = date

        if type == 1 {
            // tracking dates
            var dates = [Date]()
            var nextDate = date

            // calendar initialization
            var calendar = Calendar(identifier: .gregorian)

            calendar.firstWeekday = sharedDefaults.integer(forKey: "firstWeekday")
            calendar.minimumDaysInFirstWeek = 4

            var dictionary = [Date: Double]()
            var totalForWeek = 0.0
            var maximum = 0.0
            var numberOfDays = 0
            var weekAverage = 0.0

            for _ in 1 ... 7 {
                nextDate = calendar.date(byAdding: .day, value: 1, to: iterativeDate)!

                let holding = currentTransactions.filter {
                    $0.wrappedDate >= iterativeDate && $0.wrappedDate < nextDate
                }

                var total = 0.0

                holding.forEach { transaction in
                    total += transaction.wrappedAmount
                }

                totalForWeek += total

                dictionary[iterativeDate] = total

                if total > maximum {
                    maximum = total
                }

                if total != 0 {
                    numberOfDays += 1
                }

                dates.append(iterativeDate)
                iterativeDate = nextDate
            }

            let dateComponents = calendar.dateComponents([.weekOfYear, .yearForWeekOfYear], from: now())

            let currentWeek = calendar.date(from: dateComponents)!

            if currentWeek == date {
                let numberOfDays = Calendar.current.dateComponents([.day], from: currentWeek, to: now())

                weekAverage = totalForWeek / Double((numberOfDays.day! + 1))
            } else {
                weekAverage = totalForWeek / 7
            }

            return (totalForWeek, maximum, weekAverage, numberOfDays, dates, dictionary)
        } else if type == 2 {
            // tracking dates
            var dates = [Date]()
            var nextDate = date

            let calendar = Calendar(identifier: .gregorian)
            let range = calendar.range(of: .day, in: .month, for: iterativeDate)!

            var dictionary = [Date: Double]()
            var totalForMonth = 0.0
            var maximum = 0.0
            var numberOfDays = 0
            var monthAverage = 0.0

            for _ in 1 ... range.count {
                nextDate = calendar.date(byAdding: .day, value: 1, to: iterativeDate)!

                let holding = currentTransactions.filter {
                    $0.wrappedDate >= iterativeDate && $0.wrappedDate < nextDate
                }

                var total = 0.0

                holding.forEach { transaction in
                    total += transaction.wrappedAmount
                }

                totalForMonth += total

                dictionary[iterativeDate] = total

                if total > maximum {
                    maximum = total
                }

                if total != 0 {
                    numberOfDays += 1
                }

                dates.append(iterativeDate)
                iterativeDate = nextDate
            }

            let next = calendar.date(byAdding: .month, value: 1, to: date) ?? now()

            if next > now() {
                let numDays = Calendar.current.dateComponents([.day], from: date, to: now())

                monthAverage = totalForMonth / Double((numDays.day! + 1))
            } else {
                monthAverage = totalForMonth / Double(range.count)
            }

            return (totalForMonth, maximum, monthAverage, numberOfDays, dates, dictionary)
        } else if type == 3 {
            // trackin dates
            var dates = [Date]()
            var nextDate = date

            let calendar = Calendar(identifier: .gregorian)

            var dictionary = [Date: Double]()
            var totalForYear = 0.0
            var maximum = 0.0
            var numberOfDays = 0
            var monthAverage = 0.0

            for _ in 1 ... 12 {
                nextDate = calendar.date(byAdding: .month, value: 1, to: iterativeDate)!

                let holding = currentTransactions.filter {
                    $0.wrappedDate >= iterativeDate && $0.wrappedDate < nextDate
                }

                var total = 0.0

                holding.forEach { transaction in
                    total += transaction.wrappedAmount
                }

                totalForYear += total

                dictionary[iterativeDate] = total

                if total > maximum {
                    maximum = total
                }

                if total != 0 {
                    numberOfDays += 1
                }

                dates.append(iterativeDate)
                iterativeDate = nextDate
            }

            let dateComponents = calendar.dateComponents([.year], from: now())

            let currentYear = calendar.date(from: dateComponents)!

            if currentYear == date {
                let fromDate = Calendar.current.startOfDay(for: currentYear)
                let toDate = Calendar.current.startOfDay(for: now())
                let numDays = Calendar.current.dateComponents([.month], from: fromDate, to: toDate)

                monthAverage = totalForYear / Double((numDays.month! + 1))
            } else {
                monthAverage = totalForYear / 12
            }

            return (totalForYear, maximum, monthAverage, numberOfDays, dates, dictionary)
        } else {
            return (0, 0, 0, 0, [Date](), [Date: Double]())
        }
    }

    func fetchRequestForInsights(type: Int, date: Date, income: Bool? = nil) -> NSFetchRequest<Transaction> {
        let itemRequest: NSFetchRequest<Transaction> = Transaction.fetchRequest()

        var calendar = Calendar(identifier: .gregorian)

        calendar.firstWeekday = sharedDefaults.integer(forKey: "firstWeekday")
        calendar.minimumDaysInFirstWeek = 4

        let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), date as CVarArg)

        let endPredicate: NSPredicate

        if type == 1 {
            if calendar.isDate(date, equalTo: now(), toGranularity: .weekOfYear) {
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), now() as CVarArg)
            } else {
                let next = calendar.date(byAdding: .day, value: 7, to: date) ?? now()
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
            }
        } else if type == 2 {
            let next = calendar.date(byAdding: .month, value: 1, to: date) ?? now()

            if next > now() {
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), now() as CVarArg)
            } else {
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
            }
        } else {
            if calendar.isDate(date, equalTo: now(), toGranularity: .year) {
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), now() as CVarArg)
            } else {
                let next = calendar.date(byAdding: .year, value: 1, to: date) ?? now()
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
            }
        }

        let andPredicate: NSCompoundPredicate

        if let unwrappedIncome = income {
            let incomePredicate = NSPredicate(format: "income = %d", unwrappedIncome)

            andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, incomePredicate, endPredicate])
        } else {
            andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate])
        }

        itemRequest.predicate = andPredicate

        return itemRequest
    }

    func getInsightsSummary(type: Int, date: Date) -> (spent: Double, income: Double, net: Double, positive: Bool, average: Double) {
        let itemRequest: NSFetchRequest<Transaction> = fetchRequestForInsights(type: type, date: date)
        let currentTransactions = results(for: itemRequest)

        var holdingSpent = 0.0
        var holdingIncome = 0.0

        currentTransactions.forEach { transaction in
            if transaction.income {
                holdingIncome += transaction.amount
            } else {
                holdingSpent += transaction.amount
            }
        }

        let net = holdingIncome - holdingSpent
        let absoluteNet: Double
        let positive: Bool

        if net < 0 {
            absoluteNet = abs(net)
            positive = false
        } else {
            absoluteNet = net
            positive = true
        }

        let calendar = Calendar.current

        if type == 1 {
            if calendar.isDate(date, equalTo: Date.now, toGranularity: .weekOfYear) {
                let numberOfDays = Calendar.current.dateComponents([.day], from: date, to: Date.now)

                return (holdingSpent, holdingIncome, absoluteNet, positive, abs(net) / Double(numberOfDays.day! + 1))
            } else {
                return (holdingSpent, holdingIncome, absoluteNet, positive, abs(net) / 7)
            }
        } else if type == 2 {
            let next = calendar.date(byAdding: .month, value: 1, to: date) ?? Date.now

            if next > Date.now {
                let numDays = Calendar.current.dateComponents([.day], from: date, to: Date.now)

                return (holdingSpent, holdingIncome, absoluteNet, positive, abs(net) / Double(numDays.day! + 1))
            } else {
                let numDays = Calendar.current.dateComponents([.day], from: date, to: next)

                return (holdingSpent, holdingIncome, absoluteNet, positive, abs(net) / Double(numDays.day! + 1))
            }
        } else {
            if calendar.isDate(date, equalTo: Date.now, toGranularity: .year) {
                let numDays = Calendar.current.dateComponents([.month], from: date, to: Date.now)

                return (holdingSpent, holdingIncome, absoluteNet, positive, abs(net) / Double(numDays.month! + 1))
            } else {
                return (holdingSpent, holdingIncome, absoluteNet, positive, abs(net) / 12)
            }
        }
    }

    func fetchRequestForWidgetInsights(type: InsightsTimePeriod, income: Bool) -> (fetchRequest: NSFetchRequest<Transaction>, date: Date) {
        let itemRequest: NSFetchRequest<Transaction> = Transaction.fetchRequest()

        var calendar = Calendar(identifier: .gregorian)

        calendar.firstWeekday = sharedDefaults.integer(forKey: "firstWeekday")
        calendar.minimumDaysInFirstWeek = 4

        let endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), now() as CVarArg)

        let incomePredicate = NSPredicate(format: "income = %d", income)

        let startDate: Date
        let startPredicate: NSPredicate

        switch type {
        case .unknown:
            startDate = now()
            startPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), now() as CVarArg)
        case .week:
            let dateComponents = calendar.dateComponents([.weekOfYear, .yearForWeekOfYear], from: now())

            startDate = calendar.date(from: dateComponents)!

            startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), startDate as CVarArg)
        case .month:
            let startOfMonth = sharedDefaults.integer(forKey: "firstDayOfMonth")

            startDate = getStartOfMonth(startDay: startOfMonth)

            startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), startDate as CVarArg)
        case .year:
            let dateComponents = calendar.dateComponents([.year], from: now())

            startDate = calendar.date(from: dateComponents)!

            startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), startDate as CVarArg)
        }

        let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, incomePredicate])

        itemRequest.predicate = andPredicate
        itemRequest.sortDescriptors = [
            NSSortDescriptor(keyPath: \Transaction.date, ascending: false)
        ]

        return (itemRequest, startDate)
    }

    func fetchRequestForRecentTransactionsWithCount(type: TimePeriod, count: Int) -> NSFetchRequest<Transaction> {
        let itemRequest: NSFetchRequest<Transaction> = Transaction.fetchRequest()

        var calendar = Calendar(identifier: .gregorian)

        calendar.firstWeekday = AppIdentifiers.sharedDefaults!.integer(forKey: "firstWeekday")
        calendar.minimumDaysInFirstWeek = 4

        switch type {
        case .unknown:
            return itemRequest
        case .day:
            let today = calendar.startOfDay(for: Date.now)

            let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), today as CVarArg)
            let endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate])

            itemRequest.predicate = andPredicate
            itemRequest.sortDescriptors = [
                NSSortDescriptor(keyPath: \Transaction.date, ascending: false)
            ]
            itemRequest.fetchLimit = count

            return itemRequest
        case .week:
            let dateComponents = calendar.dateComponents([.weekOfYear, .yearForWeekOfYear], from: Date.now)

            let thisWeek = calendar.date(from: dateComponents)!

            let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), thisWeek as CVarArg)
            let endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate])

            itemRequest.predicate = andPredicate
            itemRequest.sortDescriptors = [
                NSSortDescriptor(keyPath: \Transaction.date, ascending: false)
            ]
            itemRequest.fetchLimit = count

            return itemRequest
        case .month:
            let dateComponents = calendar.dateComponents([.month, .year], from: Date.now)

            let thisMonth = calendar.date(from: dateComponents)!

            let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), thisMonth as CVarArg)
            let endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate])

            itemRequest.predicate = andPredicate
            itemRequest.sortDescriptors = [
                NSSortDescriptor(keyPath: \Transaction.date, ascending: false)
            ]
            itemRequest.fetchLimit = count

            return itemRequest
        case .year:
            let dateComponents = calendar.dateComponents([.year], from: Date.now)

            let thisYear = calendar.date(from: dateComponents)!

            let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), thisYear as CVarArg)
            let endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate])

            itemRequest.predicate = andPredicate
            itemRequest.sortDescriptors = [
                NSSortDescriptor(keyPath: \Transaction.date, ascending: false)
            ]
            itemRequest.fetchLimit = count

            return itemRequest
        }
    }

    struct LogViewInsights {
        let netTotal: Double
        let isNetPositive: Bool
        let totalSpent: Double
        let totalIncome: Double
        let lineGraphData: [LineGraphDataPoint]
    }

    /// Runs `work` against a copy of this repository bound to a background
    /// context, so callers hop threads once instead of repeating the plumbing.
    private func onBackground<T>(_ work: @escaping (TransactionRepository) throws -> T) async rethrows -> T {
        let dataController = self.dataController
        return try await dataController.performBackground { context in
            try work(TransactionRepository(dataController: dataController, context: context))
        }
    }

    /// Computes every LogView header value in one background-context pass so all
    /// four come from a single store snapshot and stay mutually consistent
    /// (income − spent always equals net).
    func getLogViewInsights(type: Int, insightsType: Int) async -> LogViewInsights {
        await onBackground { repository in
            let net = repository.getLogViewTotalNet(type: type)

            let lineGraphData: [LineGraphDataPoint]
            if insightsType == 1 {
                lineGraphData = repository.getLineGraphDataNet(type: type)
            } else if insightsType == 2 {
                lineGraphData = repository.getLineGraphData(income: true, type: type)
            } else {
                lineGraphData = repository.getLineGraphData(income: false, type: type)
            }

            return LogViewInsights(
                netTotal: net.value,
                isNetPositive: net.positive,
                totalSpent: repository.getLogViewTotalSpent(type: type),
                totalIncome: repository.getLogViewTotalIncome(type: type),
                lineGraphData: lineGraphData
            )
        }
    }

    struct GraphViewInsights: Equatable {
        struct Summary: Equatable {
            let spent: Double
            let income: Double
            let net: Double
            let positive: Bool
            let average: Double

            static let zero = Summary(spent: 0, income: 0, net: 0, positive: true, average: 0)
        }

        struct PeriodBreakdown: Equatable {
            let amount: Double
            let maximum: Double
            let average: Double
            let numberOfDays: Int
            let dates: [Date]
            let dateDictionary: [Date: Double]

            static let zero = PeriodBreakdown(amount: 0, maximum: 0, average: 0, numberOfDays: 0, dates: [], dateDictionary: [:])
        }

        let summary: Summary
        let priorSummary: Summary
        let breakdown: PeriodBreakdown

        static let empty = GraphViewInsights(summary: .zero, priorSummary: .zero, breakdown: .zero)
    }

    /// Computes the insights graph header (current + prior-period summaries for
    /// the percentage comparison) and the bar-graph breakdown in one
    /// background-context pass so all values come from a single store snapshot.
    func getGraphViewInsights(type: Int, date: Date, income: Bool) async -> GraphViewInsights {
        await onBackground { repository in
            let priorDate: Date

            if type == 1 {
                priorDate = Calendar.current.date(byAdding: .day, value: -7, to: date) ?? Date.now
            } else if type == 2 {
                priorDate = Calendar.current.date(byAdding: .month, value: -1, to: date) ?? Date.now
            } else {
                priorDate = Calendar.current.date(byAdding: .year, value: -1, to: date) ?? Date.now
            }

            func summary(for summaryDate: Date) -> GraphViewInsights.Summary {
                let loaded = repository.getInsightsSummary(type: type, date: summaryDate)
                return GraphViewInsights.Summary(spent: loaded.spent, income: loaded.income, net: loaded.net, positive: loaded.positive, average: loaded.average)
            }

            let breakdown = repository.getInsights(type: type, date: date, income: income)

            return GraphViewInsights(
                summary: summary(for: date),
                priorSummary: summary(for: priorDate),
                breakdown: GraphViewInsights.PeriodBreakdown(
                    amount: breakdown.amount,
                    maximum: breakdown.maximum,
                    average: breakdown.average,
                    numberOfDays: breakdown.numberOfDays,
                    dates: breakdown.dates,
                    dateDictionary: breakdown.dateDictionary
                )
            )
        }
    }

    func getShortcutInsights(type: Int, timeframe: Int, optionalIncome: Bool?, categories: [Category]) async throws -> Double {
        // Managed objects must not cross into the background context; carry their
        // IDs across the boundary and rematerialize them inside it.
        let categoryIDs = categories.map(\.objectID)
        return try await onBackground { repository in
            let rematerialized = categoryIDs.compactMap { (try? repository.context.existingObject(with: $0)) as? Category }
            // A dropped category must not silently widen the filter: an empty list
            // makes fetchRequestForLogView omit the category predicate entirely.
            guard rematerialized.count == categoryIDs.count else {
                throw CustomError.notFound
            }
            return repository.getShortcutInsights(type: type, timeframe: timeframe, optionalIncome: optionalIncome, categories: rematerialized)
        }
    }

    func getLogViewTotalSpent(type: Int) async -> Double {
        await onBackground { $0.getLogViewTotalSpent(type: type) }
    }

    func getLogViewTotalIncome(type: Int) async -> Double {
        await onBackground { $0.getLogViewTotalIncome(type: type) }
    }

    func getLogViewTotalNet(type: Int) async -> (value: Double, positive: Bool) {
        await onBackground { $0.getLogViewTotalNet(type: type) }
    }

    func getLineGraphDataNet(type: Int) async -> [LineGraphDataPoint] {
        await onBackground { $0.getLineGraphDataNet(type: type) }
    }

    func getLineGraphData(income: Bool, type: Int) async -> [LineGraphDataPoint] {
        await onBackground { $0.getLineGraphData(income: income, type: type) }
    }

    func getInsights(type: Int, date: Date, income: Bool) async -> (amount: Double, maximum: Double, average: Double, numberOfDays: Int, dates: [Date], dateDictionary: [Date: Double]) {
        await onBackground { $0.getInsights(type: type, date: date, income: income) }
    }

    func getInsightsSummary(type: Int, date: Date) async -> (spent: Double, income: Double, net: Double, positive: Bool, average: Double) {
        await onBackground { $0.getInsightsSummary(type: type, date: date) }
    }

    /// Fetches recent transactions and maps them to a value type inside the
    /// background context, so no managed object crosses the thread boundary.
    func getRecentTransactions<T>(type: TimePeriod, count: Int, map transform: @escaping (Transaction) -> T) async -> [T] {
        await onBackground { repository in
            let request = repository.fetchRequestForRecentTransactionsWithCount(type: type, count: count)
            return repository.results(for: request).map(transform)
        }
    }

    struct WidgetInsights: Equatable {
        struct CategoryShare: Equatable {
            let color: String
            let name: String
            let percent: Double
        }

        let amount: Double
        let maximum: Double
        let average: Double
        let numberOfDays: Int
        let dates: [Date]
        let dateDictionary: [Date: Double]
        let categories: [CategoryShare]
    }

    func getWidgetInsights(type: InsightsTimePeriod, income: Bool) -> WidgetInsights {
        let itemRequest = fetchRequestForWidgetInsights(type: type, income: income)
        let categoryRequest = dataController.categories.fetchRequestForTopLevelCategories(income: income)

        let categories = results(for: categoryRequest)
        let transactions = results(for: itemRequest.fetchRequest)
        var iterativeDate = itemRequest.date

        // Buckets a period's transactions by day (or month, for a year) and
        // computes each top-level category's share, child spending included.
        func bucket(intervals: Int, step: Calendar.Component, calendar: Calendar) -> (total: Double, maximum: Double, numberOfDays: Int, dates: [Date], dictionary: [Date: Double]) {
            var dates = [Date]()
            var nextDate = iterativeDate
            var dictionary = [Date: Double]()
            var total = 0.0
            var maximum = 0.0
            var numberOfDays = 0

            for _ in 1 ... intervals {
                nextDate = calendar.date(byAdding: step, value: 1, to: iterativeDate)!

                let holding = transactions.filter {
                    $0.wrappedDate >= iterativeDate && $0.wrappedDate < nextDate
                }

                var intervalTotal = 0.0

                holding.forEach { transaction in
                    intervalTotal += transaction.wrappedAmount
                }

                total += intervalTotal

                dictionary[iterativeDate] = intervalTotal

                if intervalTotal > maximum {
                    maximum = intervalTotal
                }

                if intervalTotal != 0 {
                    numberOfDays += 1
                }

                dates.append(iterativeDate)
                iterativeDate = nextDate
            }

            return (total, maximum, numberOfDays, dates, dictionary)
        }

        func categoryShares(total: Double) -> [WidgetInsights.CategoryShare] {
            var shares = [WidgetInsights.CategoryShare]()

            for category in categories {
                let holding = transactions.filter {
                    $0.category == category || $0.category?.parent == category
                }

                var categoryTotal = 0.0

                holding.forEach { transaction in
                    categoryTotal += transaction.wrappedAmount
                }

                if categoryTotal == 0 {
                    continue
                }

                shares.append(WidgetInsights.CategoryShare(color: category.wrappedColor, name: category.wrappedName, percent: categoryTotal / total))
            }

            shares.sort(by: { lhs, rhs in
                lhs.percent > rhs.percent
            })

            return shares
        }

        switch type {
        case .unknown:
            return WidgetInsights(amount: 0, maximum: 0, average: 0, numberOfDays: 0, dates: [Date](), dateDictionary: [Date: Double](), categories: [])
        case .week:
            var calendar = Calendar(identifier: .gregorian)

            calendar.firstWeekday = sharedDefaults.integer(forKey: "firstWeekday")
            calendar.minimumDaysInFirstWeek = 4

            let bucketed = bucket(intervals: 7, step: .day, calendar: calendar)

            let numberOfDaysPast = Calendar.current.dateComponents([.day], from: itemRequest.date, to: now())

            return WidgetInsights(
                amount: bucketed.total,
                maximum: bucketed.maximum,
                average: bucketed.total / Double(numberOfDaysPast.day! + 1),
                numberOfDays: bucketed.numberOfDays,
                dates: bucketed.dates,
                dateDictionary: bucketed.dictionary,
                categories: categoryShares(total: bucketed.total)
            )
        case .month:
            let calendar = Calendar(identifier: .gregorian)
            let range = calendar.range(of: .day, in: .month, for: iterativeDate)!

            let bucketed = bucket(intervals: range.count, step: .day, calendar: calendar)

            let numDays = Calendar.current.dateComponents([.day], from: itemRequest.date, to: now())

            return WidgetInsights(
                amount: bucketed.total,
                maximum: bucketed.maximum,
                average: bucketed.total / Double(numDays.day! + 1),
                numberOfDays: bucketed.numberOfDays,
                dates: bucketed.dates,
                dateDictionary: bucketed.dictionary,
                categories: categoryShares(total: bucketed.total)
            )
        case .year:
            let calendar = Calendar(identifier: .gregorian)

            let bucketed = bucket(intervals: 12, step: .month, calendar: calendar)

            let numDays = Calendar.current.dateComponents([.month], from: itemRequest.date, to: now())

            return WidgetInsights(
                amount: bucketed.total,
                maximum: bucketed.maximum,
                average: bucketed.total / Double(numDays.month! + 1),
                numberOfDays: bucketed.numberOfDays,
                dates: bucketed.dates,
                dateDictionary: bucketed.dictionary,
                categories: categoryShares(total: bucketed.total)
            )
        }
    }

    /// Fetches and buckets the insights widget's whole payload in one background
    /// pass, so only value types cross back into the timeline callback.
    func getWidgetInsights(type: InsightsTimePeriod, income: Bool) async -> WidgetInsights {
        await onBackground { $0.getWidgetInsights(type: type, income: income) }
    }
}
