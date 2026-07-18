//
//  TimeBudgetViews.swift
//  Outlayr
//

import Foundation
import CoreData
import SwiftUI

struct TimeBudgetView: View {
    let budget: Budget

    var budgetAmount: Double {
        return budget.amount
    }

    var budgetType: Int {
        return Int(budget.type)
    }

    @State var startDate = Date.now

    var dateString: String {
        let dateFormatter = DateFormatter()

        if budgetType == 1 {
            dateFormatter.dateFormat = "d MMM yyyy"
            return dateFormatter.string(from: startDate)
        } else if budgetType == 2 {
            let endDate = Calendar.current.date(byAdding: .day, value: 6, to: startDate) ?? Date.now
            dateFormatter.dateFormat = "d MMM"
            return dateFormatter.string(from: startDate) + " - " + dateFormatter.string(from: endDate)
        } else if budgetType == 3 {
            var endDate = Calendar.current.date(byAdding: .month, value: 1, to: startDate)!
            endDate = Calendar.current.date(byAdding: .day, value: -1, to: endDate)!
            dateFormatter.dateFormat = "d MMM"
            return dateFormatter.string(from: startDate) + " - " + dateFormatter.string(from: endDate)
        } else if budgetType == 4 {
            var endDate = Calendar.current.date(byAdding: .year, value: 1, to: startDate)!
            endDate = Calendar.current.date(byAdding: .day, value: -1, to: endDate)!
            dateFormatter.dateFormat = "d MMM yy"
            return dateFormatter.string(from: startDate) + " - " + dateFormatter.string(from: endDate)
        } else {
            return ""
        }
    }

    @State var totalSpent = 0.0

    var timeLeft: String {
        let calendar = Calendar.current

        if budgetType == 1 {
            let components = calendar.dateComponents([.hour], from: budget.wrappedDate, to: Date.now)
            return String(localized: "\(24 - (components.hour ?? 0)) hours left")
        } else {
            return String(localized: "\(daysLeftNumber) days left")
        }
    }

    var subtitleText: String {
        if budget.startDate == startDate {
            return timeLeft
        } else {
            return dateString
        }
    }

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var difference: Double {
        abs(budgetAmount - totalSpent)
    }

    var differenceSubtitle: String {
        if budgetAmount >= totalSpent {
            if startDate == budget.startDate {
                if budgetType == 1 {
                    return String(localized: "left today")
                } else if budgetType == 2 {
                    return String(localized: "left this week")
                } else if budgetType == 3 {
                    return String(localized: "left this month")
                } else if budgetType == 4 {
                    return String(localized: "left this year")
                } else {
                    return ""
                }
            } else {
                if budgetType == 1 {
                    let dateFormatter = DateFormatter()
                    dateFormatter.dateFormat = "d MMM"
                    return String(localized: "left on \(dateFormatter.string(from: startDate))")
                } else if budgetType == 2 {
                    let components = Calendar.current.dateComponents([.day], from: startDate, to: budget.wrappedDate)
                    let weekString = String(localized: "\((components.day ?? 0) / 7) weeks ago")
                    return String(localized: "left \(weekString)")
                } else if budgetType == 3 {
                    let components = Calendar.current.dateComponents([.month], from: startDate, to: budget.wrappedDate)
                    let monthString = String(localized: "\(components.month!) months ago")
                    return String(localized: "left \(monthString)")
                } else if budgetType == 4 {
                    let components = Calendar.current.dateComponents([.year], from: startDate, to: budget.wrappedDate)
                    let yearString = String(localized: "\(components.year!) months ago")
                    return String(localized: "left \(yearString)")
                } else {
                    return ""
                }
            }
        } else {
            if startDate == budget.startDate {
                if budgetType == 1 {
                    return String(localized: "over today")
                } else if budgetType == 2 {
                    return String(localized: "over this week")
                } else if budgetType == 3 {
                    return String(localized: "over this month")
                } else if budgetType == 4 {
                    return String(localized: "over this year")
                } else {
                    return ""
                }
            } else {
                if budgetType == 1 {
                    let dateFormatter = DateFormatter()
                    dateFormatter.dateFormat = "d MMM"
                    return String(localized: "over on \(dateFormatter.string(from: startDate))")
                } else if budgetType == 2 {
                    let components = Calendar.current.dateComponents([.day], from: startDate, to: budget.wrappedDate)
                    let weekString = String(localized: "\((components.day ?? 0) / 7) weeks ago")
                    return String(localized: "over \(weekString)")
                } else if budgetType == 3 {
                    let components = Calendar.current.dateComponents([.month], from: startDate, to: budget.wrappedDate)
                    let monthString = String(localized: "\(components.month!) months ago")
                    return String(localized: "over \(monthString)")
                } else if budgetType == 4 {
                    let components = Calendar.current.dateComponents([.year], from: startDate, to: budget.wrappedDate)
                    let yearString = String(localized: "\(components.year!) months ago")
                    return String(localized: "over \(yearString)")
                } else {
                    return ""
                }
            }
        }
    }

    // for week, month, year only

    var daysLeftNumber: Int {
        let calendar = Calendar.current

        if budgetType == 1 {
            return 0
        } else if budgetType == 2 {
            let components = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
            return 7 - (components.day ?? 0)
        } else if budgetType == 3 {
            let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
            let numberOfDays = components1.day!
            let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
            let numberOfDaysPast = components2.day!

            return Int(numberOfDays - numberOfDaysPast)
        } else if budgetType == 4 {
            let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
            let numberOfDays = components1.day!
            let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
            let numberOfDaysPast = components2.day!
            return Int(numberOfDays - numberOfDaysPast)
        } else {
            return 0
        }
    }

    var leftPerDay: Double {
        if budgetType >= 2 {
            return (budgetAmount - totalSpent) / Double(daysLeftNumber)
        } else {
            return 0
        }
    }

    var showExtraDetails: Bool {
        if budgetType >= 2 {
            return budget.startDate == startDate && totalSpent < budgetAmount && daysLeftNumber != 1
        } else {
            return false
        }
    }

    var body: some View {
        VStack(spacing: 20) {
            Text(subtitleText)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.SubtitleText)
                .padding(4)
                .padding(.horizontal, 7)
                .background(Color.SecondaryBackground, in: Capsule())
                .padding(.top, 12)
                .padding(.bottom, 15)

            // amount left and averages

            if budgetType >= 2 {
                HStack(alignment: .top, spacing: 15) {
                    VStack(alignment: showExtraDetails ? .leading : .center, spacing: -4) {
                        DetailedBudgetDifferenceDollarView(amount: difference, red: totalSpent >= budgetAmount)

                        Text(differenceSubtitle)
                            .font(.system(.subheadline, design: .rounded).weight(.medium))
                            .foregroundStyle(Color.SubtitleText)
                    }
                    .frame(maxWidth: .infinity, alignment: showExtraDetails ? .leading : .center)

                    if showExtraDetails {
                        VStack(alignment: .trailing, spacing: -4) {
                            DetailedBudgetDollarView(amount: leftPerDay)

                            Text("left each day")
                                .font(.system(.subheadline, design: .rounded).weight(.medium))
                                .foregroundStyle(Color.SubtitleText)
                        }
                        .frame(maxWidth: .infinity, alignment: .trailing)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 25)
            } else {
                VStack(spacing: -4) {
                    DetailedBudgetDifferenceDollarView(amount: difference, red: totalSpent >= budgetAmount)

                    Text(differenceSubtitle)
                        .font(.system(.subheadline, design: .rounded).weight(.medium))
                        .foregroundStyle(Color.SubtitleText)
                }
                .padding(.horizontal, 25)
            }

            // bar graph

            VStack(spacing: 5) {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 11.5, style: .continuous)
                            .fill(Color.SecondaryBackground)
                            .frame(width: proxy.size.width)

                        if totalSpent / budgetAmount < 0.98 {
                            if let category = budget.category {
                                AnimatedHorizontalBarGraphBudget(category: category)
                                    .frame(width: proxy.size.width * (1 - totalSpent / budgetAmount))
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .frame(height: 28)

                HStack {
                    Text("\(currencySymbol)\(totalSpent, specifier: "%.2f")")
                    Spacer()
                    Text("\(currencySymbol)\(budgetAmount, specifier: "%.2f")")
                }
                .frame(maxWidth: .infinity)
                .font(.system(.caption, design: .rounded))
                .foregroundStyle(Color.SubtitleText)
            }
            .padding(.bottom, budgetType >= 2 ? 20 : 0)
            .padding(.horizontal, 25)

            if budgetType == 1 {
                Divider()
                    .overlay(Color.Outline)
                    .padding(.horizontal, 25)
            }

            if let category = budget.category {
                ScrollView(showsIndicators: false) {
                    if budgetType == 1 {
                        FilteredCategoryDayBudgetView(category: category, day: startDate, totalSpent: $totalSpent)
                            .padding(.horizontal, 15)
                    } else {
                        FilteredBudgetView(category: category, startDate: startDate, totalSpent: $totalSpent, type: budgetType - 1)
                            .padding(.horizontal, 15)
                    }
                }
                .frame(maxHeight: .infinity)

                BudgetStepperView(category: category, date: $startDate, startDate: budget.wrappedDate, budgetType: budgetType)
                    .padding(.horizontal, 25)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .onAppear {
            startDate = budget.wrappedDate
        }
    }
}

struct FilteredCategoryDayBudgetView: View {
    @FetchRequest private var transactions: FetchedResults<Transaction>
    @Binding var totalSpent: Double
    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var date: Date

    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController
    @AppStorage("showCents", store: AppIdentifiers.sharedDefaults) var showCents: Bool = true
    @AppStorage("swapTimeLabel", store: AppIdentifiers.sharedDefaults) var swapTimeLabel: Bool = false
    @AppStorage("showExpenseOrIncomeSign", store: AppIdentifiers.sharedDefaults)
    var showExpenseOrIncomeSign: Bool = true

    var body: some View {
        VStack(spacing: 0) {
            if transactions.count == 0 {
                NoResultsView(fullscreen: false)
            } else {
                ForEach(transactions, id: \.id) { transaction in
                    SingleTransactionView(transaction: transaction, showCents: showCents, currencySymbol: currencySymbol, currency: currency, swapTimeLabel: swapTimeLabel, future: false, showExpenseOrIncomeSign: showExpenseOrIncomeSign)
                }
            }
        }
        .onAppear {
            DispatchQueue.main.async {
                var holding = 0.0
                transactions.forEach { transaction in

                    holding += transaction.wrappedAmount
                }

                totalSpent = holding
            }
        }
        .onChange(of: date) { _, _ in
            DispatchQueue.main.async {
                var holding = 0.0
                transactions.forEach { transaction in

                    holding += transaction.wrappedAmount
                }

                totalSpent = holding
            }
        }
        .frame(maxHeight: .infinity)
    }

    init(category: Category?, day: Date, totalSpent: Binding<Double>) {
        date = day

        let datePredicate = NSPredicate(format: "%K == %@", #keyPath(Transaction.day), day as CVarArg)
        let dateCapPredicate = NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)
        let incomePredicate = NSPredicate(format: "income = %d", false)

        if let unwrappedCategory = category {
            let categoryPredicate = NSPredicate(format: "%K == %@", #keyPath(Transaction.category), unwrappedCategory)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [datePredicate, categoryPredicate, incomePredicate, dateCapPredicate])

            _transactions = FetchRequest<Transaction>(sortDescriptors: [
                SortDescriptor(\.date, order: .reverse)
            ], predicate: andPredicate)
        } else {
            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [datePredicate, incomePredicate, dateCapPredicate])

            _transactions = FetchRequest<Transaction>(sortDescriptors: [
                SortDescriptor(\.date, order: .reverse)
            ], predicate: andPredicate)
        }

        _totalSpent = totalSpent
    }
}

struct FilteredBudgetView: View {
    @SectionedFetchRequest<Date?, Transaction> private var transactions: SectionedFetchResults<Date?, Transaction>

    @Binding var totalSpent: Double
    var date: Date

    var body: some View {
        VStack(spacing: 30) {
            if transactions.count == 0 {
                NoResultsView(fullscreen: false)
            }

            ListView(transactions: _transactions)
        }
        .frame(maxHeight: .infinity)
        .onAppear {
            DispatchQueue.main.async {
                var holding = 0.0
                transactions.forEach { day in

                    day.forEach { transaction in
                        holding += transaction.wrappedAmount
                    }
                }

                totalSpent = holding
            }
        }
        .onChange(of: date) { _, _ in
            DispatchQueue.main.async {
                var holding = 0.0
                transactions.forEach { day in

                    day.forEach { transaction in
                        holding += transaction.wrappedAmount
                    }
                }
                totalSpent = holding
            }
        }
    }

    init(category: Category? = nil, startDate: Date, totalSpent: Binding<Double>, type: Int) {
        date = startDate

        let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), startDate as CVarArg)
        let incomePredicate = NSPredicate(format: "income = %d", false)
        let endPredicate: NSPredicate

        var calendar = Calendar(identifier: .gregorian)

        calendar.firstWeekday = AppIdentifiers.sharedDefaults!.integer(forKey: "firstWeekday")
        calendar.minimumDaysInFirstWeek = 4

        if type == 1 {
            if calendar.isDate(startDate, equalTo: Date.now, toGranularity: .weekOfYear) {
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)
            } else {
                let next = calendar.date(byAdding: .day, value: 7, to: startDate) ?? Date.now
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
            }
        } else if type == 2 {
            if calendar.isDate(startDate, equalTo: Date.now, toGranularity: .month) {
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)
            } else {
                let next = calendar.date(byAdding: .month, value: 1, to: startDate) ?? Date.now
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
            }
        } else {
            if calendar.isDate(startDate, equalTo: Date.now, toGranularity: .year) {
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), Date.now as CVarArg)
            } else {
                let next = calendar.date(byAdding: .year, value: 1, to: startDate) ?? Date.now
                endPredicate = NSPredicate(format: "%K < %@", #keyPath(Transaction.date), next as CVarArg)
            }
        }

        if let unwrappedCategory = category {
            let categoryPredicate = NSPredicate(format: "%K == %@", #keyPath(Transaction.category), unwrappedCategory)

            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, categoryPredicate, incomePredicate])

            _transactions = SectionedFetchRequest<Date?, Transaction>(sectionIdentifier: \.day, sortDescriptors: [
                SortDescriptor(\.day, order: .reverse),
                SortDescriptor(\.date, order: .reverse)
            ], predicate: andPredicate)
        } else {
            let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, incomePredicate])

            _transactions = SectionedFetchRequest<Date?, Transaction>(sectionIdentifier: \.day, sortDescriptors: [
                SortDescriptor(\.day, order: .reverse),
                SortDescriptor(\.date, order: .reverse)
            ], predicate: andPredicate)
        }

        _totalSpent = totalSpent
    }
}

struct TimeMainBudgetView: View {
    let budget: MainBudget

    var budgetAmount: Double {
        return budget.amount
    }

    var budgetType: Int {
        return Int(budget.type)
    }

    @State var startDate = Date.now

    var dateString: String {
        let dateFormatter = DateFormatter()

        if budgetType == 1 {
            dateFormatter.dateFormat = "d MMM yyyy"
            return dateFormatter.string(from: startDate)
        } else if budgetType == 2 {
            let endDate = Calendar.current.date(byAdding: .day, value: 6, to: startDate) ?? Date.now
            dateFormatter.dateFormat = "d MMM"
            return dateFormatter.string(from: startDate) + " - " + dateFormatter.string(from: endDate)
        } else if budgetType == 3 {
            var endDate = Calendar.current.date(byAdding: .month, value: 1, to: startDate)!
            endDate = Calendar.current.date(byAdding: .day, value: -1, to: endDate)!
            dateFormatter.dateFormat = "d MMM"
            return dateFormatter.string(from: startDate) + " - " + dateFormatter.string(from: endDate)
        } else if budgetType == 4 {
            var endDate = Calendar.current.date(byAdding: .year, value: 1, to: startDate)!
            endDate = Calendar.current.date(byAdding: .day, value: -1, to: endDate)!
            dateFormatter.dateFormat = "d MMM yy"
            return dateFormatter.string(from: startDate) + " - " + dateFormatter.string(from: endDate)
        } else {
            return ""
        }
    }

    @State var totalSpent = 0.0

    var timeLeft: String {
        let calendar = Calendar.current

        if budgetType == 1 {
            let components = calendar.dateComponents([.hour], from: budget.wrappedDate, to: Date.now)
            return String(localized: "\(24 - (components.hour ?? 0)) hours left")
        } else {
            return String(localized: "\(daysLeftNumber) days left")
        }
    }

    var subtitleText: String {
        if budget.startDate == startDate {
            return timeLeft
        } else {
            return dateString
        }
    }

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var difference: Double {
        abs(budgetAmount - totalSpent)
    }

    var differenceSubtitle: String {
        if budgetAmount >= totalSpent {
            if startDate == budget.startDate {
                if budgetType == 1 {
                    return String(localized: "left today")
                } else if budgetType == 2 {
                    return String(localized: "left this week")
                } else if budgetType == 3 {
                    return String(localized: "left this month")
                } else if budgetType == 4 {
                    return String(localized: "left this year")
                } else {
                    return ""
                }
            } else {
                if budgetType == 1 {
                    let dateFormatter = DateFormatter()
                    dateFormatter.dateFormat = "d MMM"
                    return String(localized: "left on \(dateFormatter.string(from: startDate))")
                } else if budgetType == 2 {
                    let components = Calendar.current.dateComponents([.day], from: startDate, to: budget.wrappedDate)
                    let weekString = String(localized: "\((components.day ?? 0) / 7) weeks ago")
                    return String(localized: "left \(weekString)")
                } else if budgetType == 3 {
                    let components = Calendar.current.dateComponents([.month], from: startDate, to: budget.wrappedDate)
                    let monthString = String(localized: "\(components.month!) months ago")
                    return String(localized: "left \(monthString)")
                } else if budgetType == 4 {
                    let components = Calendar.current.dateComponents([.year], from: startDate, to: budget.wrappedDate)
                    let yearString = String(localized: "\(components.year!) months ago")
                    return String(localized: "left \(yearString)")
                } else {
                    return ""
                }
            }
        } else {
            if startDate == budget.startDate {
                if budgetType == 1 {
                    return String(localized: "over today")
                } else if budgetType == 2 {
                    return String(localized: "over this week")
                } else if budgetType == 3 {
                    return String(localized: "over this month")
                } else if budgetType == 4 {
                    return String(localized: "over this year")
                } else {
                    return ""
                }
            } else {
                if budgetType == 1 {
                    let dateFormatter = DateFormatter()
                    dateFormatter.dateFormat = "d MMM"
                    return String(localized: "over on \(dateFormatter.string(from: startDate))")
                } else if budgetType == 2 {
                    let components = Calendar.current.dateComponents([.day], from: startDate, to: budget.wrappedDate)
                    let weekString = String(localized: "\((components.day ?? 0) / 7) weeks ago")
                    return String(localized: "over \(weekString)")
                } else if budgetType == 3 {
                    let components = Calendar.current.dateComponents([.month], from: startDate, to: budget.wrappedDate)
                    let monthString = String(localized: "\(components.month!) months ago")
                    return String(localized: "over \(monthString)")
                } else if budgetType == 4 {
                    let components = Calendar.current.dateComponents([.year], from: startDate, to: budget.wrappedDate)
                    let yearString = String(localized: "\(components.year!) months ago")
                    return String(localized: "over \(yearString)")
                } else {
                    return ""
                }
            }
        }
    }

    // for week, month, year only

    var daysLeftNumber: Int {
        let calendar = Calendar.current

        if budgetType == 1 {
            return 0
        } else if budgetType == 2 {
            let components = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
            return 7 - (components.day ?? 0)
        } else if budgetType == 3 {
            let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
            let numberOfDays = components1.day!
            let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
            let numberOfDaysPast = components2.day!

            return Int(numberOfDays - numberOfDaysPast)
        } else if budgetType == 4 {
            let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
            let numberOfDays = components1.day!
            let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
            let numberOfDaysPast = components2.day!
            return Int(numberOfDays - numberOfDaysPast)
        } else {
            return 0
        }
    }

    var leftPerDay: Double {
        if budgetType >= 2 {
            return (budgetAmount - totalSpent) / Double(daysLeftNumber)
        } else {
            return 0
        }
    }

    var showExtraDetails: Bool {
        if budgetType >= 2 {
            return budget.startDate == startDate && totalSpent < budgetAmount && daysLeftNumber != 1
        } else {
            return false
        }
    }

    var body: some View {
        VStack(spacing: 20) {
            Text(subtitleText)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.SubtitleText)
                .padding(4)
                .padding(.horizontal, 7)
                .background(Color.SecondaryBackground, in: Capsule())
                .padding(.top, 12)
                .padding(.bottom, 15)

            // amount left and averages

            if budgetType >= 2 {
                HStack(alignment: .top, spacing: 15) {
                    VStack(alignment: showExtraDetails ? .leading : .center, spacing: -4) {
                        DetailedBudgetDifferenceDollarView(amount: difference, red: totalSpent >= budgetAmount)

                        Text(differenceSubtitle)
                            .font(.system(.subheadline, design: .rounded).weight(.medium))
                            .foregroundStyle(Color.SubtitleText)
                    }
                    .frame(maxWidth: .infinity, alignment: showExtraDetails ? .leading : .center)

                    if showExtraDetails {
                        VStack(alignment: .trailing, spacing: -4) {
                            DetailedBudgetDollarView(amount: leftPerDay)

                            Text("left each day")
                                .font(.system(.subheadline, design: .rounded).weight(.medium))
                                .foregroundStyle(Color.SubtitleText)
                        }
                        .frame(maxWidth: .infinity, alignment: .trailing)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 25)
            } else {
                VStack(spacing: -4) {
                    DetailedBudgetDifferenceDollarView(amount: difference, red: totalSpent >= budgetAmount)

                    Text(differenceSubtitle)
                        .font(.system(.subheadline, design: .rounded).weight(.medium))
                        .foregroundStyle(Color.SubtitleText)
                }
                .padding(.horizontal, 25)
            }

            // bar graph

            VStack(spacing: 5) {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 11.5, style: .continuous)
                            .fill(Color.SecondaryBackground)
                            .frame(width: proxy.size.width)

                        if totalSpent / budgetAmount < 0.98 {
                            AnimatedHorizontalBarGraphMainBudget()
                                .frame(width: proxy.size.width * (1 - totalSpent / budgetAmount))
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .frame(height: 28)

                HStack {
                    Text("\(currencySymbol)\(totalSpent, specifier: "%.2f")")
                    Spacer()
                    Text("\(currencySymbol)\(budgetAmount, specifier: "%.2f")")
                }
                .frame(maxWidth: .infinity)
                .font(.system(.caption, design: .rounded))
                .foregroundStyle(Color.SubtitleText)
            }
            .padding(.bottom, budgetType >= 2 ? 20 : 0)
            .padding(.horizontal, 25)

            if budgetType == 1 {
                Divider()
                    .overlay(Color.Outline)
                    .padding(.horizontal, 25)
            }

            ScrollView(showsIndicators: false) {
                if budgetType == 1 {
                    FilteredCategoryDayBudgetView(category: nil, day: startDate, totalSpent: $totalSpent)
                        .padding(.horizontal, 15)
                } else {
                    FilteredBudgetView(category: nil, startDate: startDate, totalSpent: $totalSpent, type: budgetType - 1)
                        .padding(.horizontal, 15)
                }
            }
            .frame(maxHeight: .infinity)

            BudgetStepperView(category: nil, date: $startDate, startDate: budget.wrappedDate, budgetType: budgetType)
                .padding(.horizontal, 25)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .onAppear {
            startDate = budget.wrappedDate
        }
    }
}
