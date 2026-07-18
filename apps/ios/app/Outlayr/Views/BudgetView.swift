//
//  BudgetView.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import CoreData
import Foundation
import SwiftUI

struct BudgetView: View {
    @FetchRequest(sortDescriptors: []) private var categories: FetchedResults<Category>
    @FetchRequest(sortDescriptors: []) private var budgets: FetchedResults<Budget>
    @FetchRequest(sortDescriptors: []) private var mainBudget: FetchedResults<MainBudget>

    var body: some View {
        if categories.isEmpty && budgets.isEmpty && mainBudget.isEmpty {
            VStack(spacing: 5) {
                Image("category-3")
                    .resizable()
                    .frame(width: 75, height: 75)
                    .padding(.bottom, 20)

                Text("Budget Your Finances")
                    .font(.system(.title2, design: .rounded).weight(.medium))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.PrimaryText.opacity(0.8))

                Text("Link budgets to categories and set appropriate expenditure goals")
                    .font(.system(.body, design: .rounded).weight(.medium))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.SubtitleText.opacity(0.7))
            }
            .padding(.horizontal, 30)
            .frame(height: 250, alignment: .top)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .ignoresSafeArea(.all)
            .background(Color.PrimaryBackground)

        } else {
            ActualBudgetView()
        }
    }
}

struct ActualBudgetView: View {
    @Environment(\.colorScheme) var colorScheme
    @State private var showInfo = false

    @FetchRequest(sortDescriptors: [
        SortDescriptor(\.dateCreated)
    ]) private var budgets: FetchedResults<Budget>
    @FetchRequest(sortDescriptors: []) private var mainBudget: FetchedResults<MainBudget>
    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController
    @Environment(TabBarManager.self) private var tabBarManager

    @State var newBudget = false

    @State private var showMenu = false

    @State private var toDelete: Budget?
    @State private var toEdit: Budget?

    let layout = [
        GridItem(.flexible(), spacing: 15),
        GridItem(.flexible(), spacing: 15)
    ]

    @AppStorage("budgetViewStyle", store: AppIdentifiers.sharedDefaults) var budgetRows: Bool = false

    @Namespace var animation

    var didSave = NotificationCenter.default.publisher(for: .NSManagedObjectContextDidSave) // the publisher
    @AppStorage("UUID") var refreshID = UUID().uuidString

    @State var date = Date.now

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if !budgets.isEmpty || !mainBudget.isEmpty {
                    ScrollView(showsIndicators: false) {
                        VStack {
                            if let first = mainBudget.first {
                                NavigationLink(destination: DetailedMainBudgetView(budget: first)
                                    .onAppear {
                                        withAnimation(.easeOut.speed(2)) {
                                            tabBarManager.navigationHideTab()
                                        }
                                    }
                                    .onDisappear {
                                        withAnimation(.easeOut.speed(2)) {
                                            tabBarManager.navigationShowTab()
                                        }
                                    }

                                ) {
                                    if budgets.count == 0 {
                                        MainBudgetView(budget: first, solo: true)
                                            .padding(.horizontal, 25)
                                            .padding(.bottom, 15)
                                            .id(refreshID)
                                    } else {
                                        MainBudgetView(budget: first, solo: false)
                                            .padding(.horizontal, 25)
                                            .padding(.bottom, 15)
                                            .id(refreshID)
                                    }
                                }
                            }

                            if budgetRows {
                                VStack(spacing: 10) {
                                    ForEach(budgets, id: \.self) { budget in
                                        NavigationLink(destination: DetailedBudgetView(budget: budget)
                                            .onAppear {
                                                withAnimation(.easeOut.speed(2)) {
                                                    tabBarManager.navigationHideTab()
                                                }
                                            }
                                            .onDisappear {
                                                withAnimation(.easeOut.speed(2)) {
                                                    tabBarManager.navigationShowTab()
                                                }
                                            }

                                        ) {
                                            SingleBudgetView(budget: budget, toDelete: $toDelete, toEdit: $toEdit, budgetRows: budgetRows)
                                        }
                                    }
                                }

                            } else {
                                LazyVGrid(columns: layout, spacing: 15) {
                                    ForEach(budgets, id: \.self) { budget in
                                        NavigationLink(destination: DetailedBudgetView(budget: budget)
                                            .onAppear {
                                                withAnimation(.easeOut.speed(2)) {
                                                    tabBarManager.navigationHideTab()
                                                }
                                            }
                                            .onDisappear {
                                                withAnimation(.easeOut.speed(2)) {
                                                    tabBarManager.navigationShowTab()
                                                }
                                            }

                                        ) {
                                            SingleBudgetView(budget: budget, toDelete: $toDelete, toEdit: $toEdit, budgetRows: budgetRows)
                                        }
                                    }
                                }
                                .padding(.horizontal, 25)
                                .padding(5)
                            }
                        }
                        .padding(.bottom, 70)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .id(refreshID)
                } else {
                    BudgetEmptyStateView { newBudget = true }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .navigationTitle("Budgets")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        newBudget = true
                    } label: {
                        Label("New Budget", systemImage: "plus")
                    }
                }
            }
            .background(Color.PrimaryBackground)
            .sheet(item: $toEdit, onDismiss: {
                toEdit = nil
            }) { budget in
                BrandNewBudgetView(overallBudgetCreated: !mainBudget.isEmpty, toEditBudget: budget)
            }
            .onAppear {
                dataController.updateBudgetDates()
            }
            .sheet(isPresented: $newBudget) {
                BrandNewBudgetView(overallBudgetCreated: !mainBudget.isEmpty)
            }
            .deleteBudgetConfirmation($toDelete)
            .onReceive(self.didSave) { _ in // the listener
                withAnimation {
                    refreshID = UUID().uuidString
                }
            }
        }
    }
}

struct MainBudgetView: View {
    let budget: MainBudget
    @FetchRequest<Transaction> private var transactions: FetchedResults<Transaction>

    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController

    @State var toEdit: MainBudget?
    @State var toDelete: MainBudget?
    @State var totalSpent: Double = 0

    var soloBudget: Bool

    var budgetAmount: Double {
        if budget.isFault {
            return 0.0
        }

        return budget.amount
    }

    var budgetType: String {
        if budget.isFault {
            return ""
        }

        switch budget.type {
        case 1:
            return String(localized: "today")
        case 2:
            return String(localized: "this week")
        case 3:
            return String(localized: "this month")
        case 4:
            return String(localized: "this year")
        default:
            return "this week"
        }
    }

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var percentageOfDays: Double {
        let calendar = Calendar.current

        if budget.isFault {
            return 0.0
        }

        if budget.type == 1 {
            let components = calendar.dateComponents([.minute], from: budget.wrappedDate, to: Date.now)
            return Double(components.minute ?? 0) / 1440
        }

        let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
        let numberOfDays = components1.day ?? 0

        let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
        let numberOfDaysPast = components2.day ?? 0

        return Double(numberOfDaysPast) / Double(numberOfDays)
    }

    var targetPercent: Double {
        let calendar = Calendar.current

        if budget.isFault {
            return 0.0
        }

        let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
        let numberOfDays = components1.day ?? 0

        let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
        let numberOfDaysPast = (components2.day ?? 0) + 1

        return Double(numberOfDays - numberOfDaysPast) / Double(numberOfDays)
    }

    var triangleOffset: (x: Double, y: Double) {
        var x = 0.0
        var y = -5.0

        let radius = (width / 2) - 5

        if targetPercent > 0.5 {
            let angle = (CGFloat.pi) * (1 - targetPercent)
            y += (radius - (radius * sin(angle)))
            x += (radius * cos(angle))
        } else if targetPercent < 0.5 {
            let angle = (CGFloat.pi) * targetPercent
            y += (radius - (radius * sin(angle)))
            x -= (radius * cos(angle))
        }

        return (x, y)
    }

    var triangleRotation: Double {
        if targetPercent > 0.5 {
            return ((targetPercent - 0.5) / 0.5) * 90
        } else if targetPercent < 0.5 {
            return -((0.5 - targetPercent) / 0.5) * 90
        } else {
            return 0
        }
    }

    var difference: Double {
        return abs(budgetAmount - totalSpent)
    }

    var percentString: String {
        if !budget.isFault {
            return "\(Int(round(100 - (totalSpent / budgetAmount) * 100)))%"
        } else {
            return ""
        }
    }

    var percentString1: String {
        if !budget.isFault {
            return "\(Int(round((totalSpent / budgetAmount) * 100)))%"
        } else {
            return ""
        }
    }

    var width: CGFloat {
        if soloBudget {
            return UIScreen.main.bounds.width - 90
        } else {
            return 250
        }
    }

    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        VStack(spacing: 5) {
            gaugeSection

            amountLabels
        }
        .padding(.bottom)
        .frame(width: width + 30, height: soloBudget ? 230 : 200, alignment: .bottom)
        .background(soloBudget ? Color.Outline.opacity(0.2) : Color.PrimaryBackground, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 13))
        .contextMenu {
            Button {
                toEdit = budget

            } label: {
                Label("Edit", systemImage: "pencil")
            }
            Button {
                toDelete = budget

            } label: {
                Label("Delete", systemImage: "xmark.bin")
            }
        }
        .onAppear {
            if budget.isFault {
                return
            }

            var holdingTotal = 0.0
            transactions.forEach { transaction in
                holdingTotal += transaction.wrappedAmount
            }

            totalSpent = holdingTotal
        }
        .sheet(item: $toEdit, onDismiss: {
            toEdit = nil
        }) { budget in
            BrandNewBudgetView(overallBudgetCreated: true, toEditMainBudget: budget)
        }
        .deleteMainBudgetConfirmation($toDelete)
    }

    private var gaugeSection: some View {
        ZStack(alignment: .bottom) {
                ZStack {
                    DonutSemicircle(percent: 1, cornerRadius: 6.5, width: soloBudget ? 35 : 25)
                        .fill(Color.SecondaryBackground)
                        .frame(width: width, height: width / 2)

                    if totalSpent / budgetAmount < 0.97 {
                        AnimatedCurvedBarGraphMainBudget(transactions: transactions, budgetTotal: budgetAmount, cornerRadius: 6.5, width: soloBudget ? 35 : 25)
                            .frame(width: width, height: width / 2)
                    }
                }
                .overlay(alignment: .top) {
                    if budget.type != 1 && totalSpent < budgetAmount && targetPercent > 0 {
                        RoundedTriangle(cornerRadius: 2)

                            .fill((targetPercent * budgetAmount) < (budgetAmount - totalSpent) ? Color.SubtitleText : Color.BudgetRed)
                            .frame(width: 20, height: 10)
                            .rotationEffect(Angle(degrees: triangleRotation), anchor: .bottom)
                            .offset(x: triangleOffset.x, y: triangleOffset.y)
                    }
                }

                CurvedText(text: String(localized: "OVERALL SPENT: \(percentString1)"), radius: width / 2 + 8)
                    .font(.system(.footnote, design: .rounded).weight(.medium))
                    .foregroundStyle(Color.SubtitleText)
                    .frame(width: width, height: 10)

                VStack(spacing: -4) {
                    let internalWidth = soloBudget ? width - 90 : width - 60
                    BudgetDollarView(amount: difference, red: totalSpent >= budgetAmount, scale: 3, size: internalWidth)
                        .frame(width: internalWidth)

                    Text("\(budgetAmount >= totalSpent ? "left" : "over") \(budgetType)")
                        .font(.system(.subheadline, design: .rounded).weight(.medium))
                        .foregroundStyle(Color.SubtitleText)
                }
            }
    }

    private var amountLabels: some View {
        HStack {
                if totalSpent < 1000 && budgetAmount < 1000 {
                    Text("\(totalSpent, specifier: "%.2f")")
                        .frame(width: 60, alignment: .leading)
                    Spacer()
                    Text("\(budgetAmount, specifier: "%.2f")")
                        .frame(width: 60, alignment: .trailing)
                } else {
                    Text("\(Int(round(totalSpent)))")
                        .frame(width: 60, alignment: .leading)
                    Spacer()
                    Text("\(Int(round(budgetAmount)))")
                        .frame(width: 60, alignment: .trailing)
                }
            }
            .font(.system(.caption2, design: .rounded).weight(.medium))
            .frame(width: width)
            .foregroundStyle(Color.SubtitleText)
    }

    init(budget: MainBudget, solo: Bool) {
        self.budget = budget
        soloBudget = solo

        let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), budget.wrappedDate as CVarArg)
        let endPredicate = NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)
        let incomePredicate = NSPredicate(format: "income = %d", false)

        let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, incomePredicate])

        _transactions = FetchRequest<Transaction>(sortDescriptors: [], predicate: andPredicate)
    }
}

struct SingleBudgetView: View {
    let budget: Budget
    @FetchRequest<Transaction> private var transactions: FetchedResults<Transaction>

    @Binding var toDelete: Budget?
    @Binding var toEdit: Budget?

    @State var totalSpent: Double = 0

    var budgetRows: Bool

    var width: CGFloat {
        ((UIScreen.main.bounds.width - 75) / 2) - 30
    }

    var rowWidth: CGFloat {
        (UIScreen.main.bounds.width - 80) / 2
    }

    var budgetAmount: Double {
        if budget.isFault {
            return 0.0
        }

        return budget.amount
    }

    var budgetType: String {
        if budget.isFault {
            return ""
        }

        switch budget.type {
        case 1:
            return String(localized: "today")
        case 2:
            return String(localized: "this week")
        case 3:
            return String(localized: "this month")
        case 4:
            return String(localized: "this year")
        default:
            return "this week"
        }
    }

    var timeLeft: String {
        let calendar = Calendar.current

        if budget.isFault {
            return ""
        }

        if budgetRows {
            if budget.type == 1 {
                let components = calendar.dateComponents([.hour], from: budget.wrappedDate, to: Date.now)

                return String(localized: "\(24 - components.hour!)h left")
            } else if budget.type == 2 {
                let components = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)

                return String(localized: "\(7 - (components.day ?? 0))d left")
            } else {
                let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
                let numberOfDays = components1.day ?? 0

                let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
                let numberOfDaysPast = components2.day ?? 0

                let daysLeftNumber = Int(numberOfDays - numberOfDaysPast)
                return String(localized: "\(daysLeftNumber)d left"
                )
            }
        } else {
            if budget.type == 1 {
                let components = calendar.dateComponents([.hour], from: budget.wrappedDate, to: Date.now)

                return String(localized: "\(24 - (components.hour ?? 0)) hours left")
            } else if budget.type == 2 {
                let components = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)

                return String(localized: "\(7 - (components.day ?? 0)) days left")
            } else {
                let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
                let numberOfDays = components1.day ?? 0

                let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
                let numberOfDaysPast = components2.day ?? 0

                let daysLeftNumber = Int(numberOfDays - numberOfDaysPast)
                return String(localized: "\(daysLeftNumber) days left")
            }
        }
    }

    @AppStorage("currency", store: AppIdentifiers.sharedDefaults) var currency: String = Locale.current.currency!.identifier
    var currencySymbol: String {
        return Locale.current.localizedCurrencySymbol(forCurrencyCode: currency)!
    }

    var difference: Double {
        return abs(budgetAmount - totalSpent)
    }

    var percentString: String {
        if !budget.isFault {
            return "\(Int(round(100 - (totalSpent / budgetAmount) * 100)))%"
        } else {
            return ""
        }
    }

    var percentString1: String {
        if !budget.isFault {
            return "\(Int(round((totalSpent / budgetAmount) * 100)))%"
        } else {
            return ""
        }
    }

    var targetPercent: Double {
        let calendar = Calendar.current

        if budget.isFault {
            return 0.0
        }

        let components1 = calendar.dateComponents([.day], from: budget.wrappedDate, to: budget.endDate)
        let numberOfDays = components1.day ?? 0

        let components2 = calendar.dateComponents([.day], from: budget.wrappedDate, to: Date.now)
        let numberOfDaysPast = components2.day ?? 0 + 1

        return Double(numberOfDays - numberOfDaysPast) / Double(numberOfDays)
    }

    @Environment(\.colorScheme) var colorScheme

    // swipe to delete
    @Environment(\.managedObjectContext) var moc
    @Environment(DataController.self) private var dataController
    @State private var offset: CGFloat = 0
    @State private var deleted: Bool = false

    var deletePopup: Bool {
        return abs(offset) > UIScreen.main.bounds.width * 0.15
    }

    var deleteConfirm: Bool {
        return abs(offset) > UIScreen.main.bounds.width * 0.50
    }

    @GestureState var isDragging = false

    var body: some View {
        Group {
            if budgetRows {
                rowLayout
            } else {
                cardLayout
            }
        }
        .onAppear {
            if budget.isFault {
                return
            }

            var holdingTotal = 0.0
            transactions.forEach { transaction in
                holdingTotal += transaction.wrappedAmount
            }

            totalSpent = holdingTotal
        }
    }

    private var rowLayout: some View {
        ZStack(alignment: .trailing) {
                    Image(systemName: "xmark")
                        .font(.system(.footnote, design: .rounded).weight(.bold))
                        .foregroundStyle(deleteConfirm ? Color.AlertRed : Color.SubtitleText)
                        .padding(5)
                        .background(deleteConfirm ? Color.AlertRed.opacity(0.23) : Color.SecondaryBackground, in: Circle())
                        .scaleEffect(deleteConfirm ? 1.1 : 1)
                        .contentShape(Circle())
                        .opacity(deleted ? 0 : 1)
                        .padding(.horizontal, 10)
                        .offset(x: 80)
                        .offset(x: max(-80, offset))

                    HStack {
                        HStack(spacing: 10) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(.white)

                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(Color(hex: budget.wrappedColour).opacity(0.3))
                            }
                            .frame(width: 40, height: 40)
                            .overlay {
                                Text(budget.wrappedEmoji)
                                    .font(.system(size: 20))
                            }

                            VStack(alignment: .leading, spacing: -0.5) {
                                Text(budget.wrappedName)
                                    .font(.system(.body, design: .rounded).weight(.semibold))
                                    .lineLimit(1)
                                    .foregroundStyle(Color.PrimaryText)

                                Text("\(timeLeft) • \(percentString1) spent")
                                    .font(.system(.footnote, design: .rounded).weight(.medium))
                                    .lineLimit(1)
                                    .foregroundStyle(Color.SubtitleText)
                            }
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: -4) {
                            BudgetDollarView(amount: difference, red: totalSpent >= budgetAmount, scale: 1, size: 80)

                            Text("\(budgetAmount >= totalSpent ? "left" : "over") \(budgetType)")
                                .font(.system(.caption2, design: .rounded).weight(.medium))
                                .foregroundStyle(Color.SubtitleText)
                        }
                    }
                    .padding(10)
                    .background(colorScheme == .dark ? Color.Outline.opacity(0.2) : Color.Outline.opacity(0.35), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                    .contentShape(RoundedRectangle(cornerRadius: 13))
                    .contextMenu {
                        Button {
                            toEdit = budget

                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        Button {
                            toDelete = budget
                        } label: {
                            Label("Delete", systemImage: "xmark.bin")
                        }
                    }
                    .offset(x: offset)
                }
                .padding(.horizontal, 30)
                .onChange(of: deletePopup) { _, _ in
                    if deletePopup {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    }
                }
                .onChange(of: deleteConfirm) { _, _ in
                    if deleteConfirm {
                        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
                    }
                }
                .animation(.default, value: deletePopup)
                .simultaneousGesture(
                    DragGesture()
                        .updating($isDragging, body: { _, state, _ in
                            state = true
                        })
                        .onChanged { value in
                            if value.translation.width < 0 {
                                offset = value.translation.width
                            }
                        }.onEnded { _ in
                            if deleteConfirm {
                                deleted = true
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    offset -= UIScreen.main.bounds.width
                                }

                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                                    withAnimation {
                                        moc.delete(budget)
                                        dataController.save()
                                    }
                                }

                            } else if deletePopup {
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    offset = 0
                                }

                                toDelete = budget
                            } else {
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    offset = 0
                                }
                            }
                        }
                )
                .onChange(of: isDragging) { _, _ in
                    if !isDragging && !deleted {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            offset = 0
                        }
                    }
                }
    }

    private var cardLayout: some View {
        VStack {
                    HStack {
                        VStack(alignment: .leading, spacing: 0.5) {
                            HStack(spacing: 4) {
                                Text(budget.wrappedEmoji)
                                    .font(.system(.caption, design: .rounded))

                                Text(budget.wrappedName)
                                    .font(.system(.subheadline, design: .rounded).weight(.semibold))
                                    .lineLimit(1)
                                    .foregroundStyle(Color.PrimaryText)
                            }

                            Text(timeLeft)
                                .font(.system(.footnote, design: .rounded).weight(.semibold))
                                .foregroundStyle(Color.SubtitleText)
                                .multilineTextAlignment(.leading)
                        }

                        Spacer()
                    }
                    .frame(maxWidth: .infinity)

                    Spacer(minLength: 30)

                    HStack {
                        VStack(alignment: .leading, spacing: -2) {
                            if totalSpent < budgetAmount {
                                Text("\(percentString1) SPENT")
                                    .font(.system(.caption2, design: .rounded).weight(.semibold))
                                    .lineLimit(1)
                                    .foregroundStyle(totalSpent / budgetAmount > 1 ? Color("BudgetRed") : Color.IncomeGreen)
                                    .padding(.bottom, 5)
                            }

                            BudgetDollarView(amount: difference, red: totalSpent >= budgetAmount, scale: 2, size: width - 40)

                            Text("\(budgetAmount >= totalSpent ? "left" : "over") \(budgetType)")
                                .font(.system(.footnote, design: .rounded).weight(.medium))
                                .foregroundStyle(Color.SubtitleText)
                                .minimumScaleFactor(0.7)
                                .lineLimit(1)
                        }

                        Spacer()
                    }
                    .frame(maxWidth: .infinity)

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
                        .overlay(alignment: .topLeading) {
                            if budget.type != 1 && totalSpent < budgetAmount && targetPercent > 0 && targetPercent < 0.95 {
                                RoundedTriangle(cornerRadius: 1.3)
                                    .fill((targetPercent * budgetAmount) <= (budgetAmount - totalSpent) ? Color.DarkBackground : Color.BudgetRed)
                                    .frame(width: 14, height: 6.5)
                                    .offset(x: (targetPercent * proxy.size.width) - 7, y: -3.5)
                            }
                        }
                    }
                    .frame(height: 17.5)
                }
                .padding(15)
                .frame(width: width + 30)
                .background(colorScheme == .dark ? Color.Outline.opacity(0.2) : Color.Outline.opacity(0.35), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                .contentShape(RoundedRectangle(cornerRadius: 13))
                .contextMenu {
                    Button {
                        toEdit = budget

                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }
                    Button {
                        toDelete = budget
                    } label: {
                        Label("Delete", systemImage: "xmark.bin")
                    }
                }
    }

    init(budget: Budget, toDelete: Binding<Budget?>?, toEdit: Binding<Budget?>?, budgetRows: Bool) {
        self.budget = budget
        self.budgetRows = budgetRows
        _toDelete = toDelete ?? Binding.constant(nil)
        _toEdit = toEdit ?? Binding.constant(nil)

        let date = budget.startDate ?? Date.now

        let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), date as CVarArg)
        let endPredicate = NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)
        let incomePredicate = NSPredicate(format: "income = %d", false)

        let andPredicate: NSCompoundPredicate

        if let category = budget.category {
            let categoryPredicate = NSPredicate(format: "%K == %@", #keyPath(Transaction.category), category)
            andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, categoryPredicate, incomePredicate])

            _transactions = FetchRequest<Transaction>(sortDescriptors: [], predicate: andPredicate)
        } else {
            andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, incomePredicate])

            _transactions = FetchRequest<Transaction>(sortDescriptors: [], predicate: andPredicate)
        }
    }
}
