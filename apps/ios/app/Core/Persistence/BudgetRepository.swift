//
//  BudgetRepository.swift
//  Outlayr
//

import CoreData
import Foundation

struct BudgetRepository {
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

    private func results<T: NSManagedObject>(for fetchRequest: NSFetchRequest<T>) -> [T] {
        (try? context.fetch(fetchRequest)) ?? []
    }

    private func save() {
        dataController.save()
    }

    func getAllBudgets() -> [Budget] {
        let request: NSFetchRequest<Budget> = Budget.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(key: "dateCreated", ascending: true)]
        return results(for: request)
    }

    @available(iOS 16, *)
    func findBudget(withId id: UUID) throws -> Budget {
        let request: NSFetchRequest<Budget> = Budget.fetchRequest()
        request.fetchLimit = 1
        request.predicate = NSPredicate(format: "id = %@", id as CVarArg)

        do {
            guard let foundBudget = try context.fetch(request).first else {
                throw CustomError.notFound
            }
            return foundBudget
        } catch {
            throw CustomError.notFound
        }
    }

    func fetchRequestForBudgets() -> NSFetchRequest<Budget> {
        let itemRequest: NSFetchRequest<Budget> = Budget.fetchRequest()

        return itemRequest
    }

    func fetchRequestForMainBudget() -> NSFetchRequest<MainBudget> {
        let itemRequest: NSFetchRequest<MainBudget> = MainBudget.fetchRequest()

        return itemRequest
    }

    func updateBudgetDates() {
        let budgets = results(for: fetchRequestForBudgets())
        let mainBudget = results(for: fetchRequestForMainBudget())

        budgets.forEach { budget in
            while budget.endDate <= now() {
                budget.startDate = budget.endDate
            }
        }

        mainBudget.forEach { budget in
            while budget.endDate <= now() {
                budget.startDate = budget.endDate
            }
        }

        save()
    }

    func getBudgetLeftover(budget: Budget? = nil, overallBudget: MainBudget? = nil) -> Double {
        let itemRequest: NSFetchRequest<Transaction>
        let budgetAmount: Double

        if let unwrappedOverallBudget = overallBudget {
            itemRequest = fetchRequestForMainBudgetTransactions(budget: unwrappedOverallBudget)
            budgetAmount = unwrappedOverallBudget.amount
        } else if let unwrappedBudget = budget {
            itemRequest = fetchRequestForBudgetTransactions(budget: unwrappedBudget)
            budgetAmount = unwrappedBudget.amount
        } else {
            itemRequest = Transaction.fetchRequest()
            budgetAmount = 0
        }

        let transactions = results(for: itemRequest)

        var totalSpent = 0.0

        transactions.forEach { transaction in
            totalSpent += transaction.wrappedAmount
        }

        return budgetAmount - totalSpent
    }

    func fetchRequestForMainBudgetTransactions(budget: MainBudget) -> NSFetchRequest<Transaction> {
        let itemRequest: NSFetchRequest<Transaction> = Transaction.fetchRequest()

        let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), budget.startDate! as CVarArg)
        let endPredicate = NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)
        let incomePredicate = NSPredicate(format: "income = %d", false)

        let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, incomePredicate])

        itemRequest.predicate = andPredicate

        return itemRequest
    }

    func fetchRequestForBudgetTransactions(budget: Budget) -> NSFetchRequest<Transaction> {
        let itemRequest: NSFetchRequest<Transaction> = Transaction.fetchRequest()

        let startPredicate = NSPredicate(format: "%K >= %@", #keyPath(Transaction.date), budget.startDate! as CVarArg)
        let endPredicate = NSPredicate(format: "%K <= %@", #keyPath(Transaction.date), Date.now as CVarArg)
        let categoryPredicate = NSPredicate(format: "category == %@ OR category.parent == %@", budget.category!, budget.category!)
        let incomePredicate = NSPredicate(format: "income = %d", false)

        let andPredicate = NSCompoundPredicate(type: .and, subpredicates: [startPredicate, endPredicate, categoryPredicate, incomePredicate])

        itemRequest.predicate = andPredicate

        return itemRequest
    }

    func fetchRequestForMainBudgetWidget() -> (found: Bool, totalSpent: Double, budgetAmount: Double, percentage: Double, type: Int, startDate: Date) {
        let holding = results(for: fetchRequestForMainBudget())

        if let budget = holding.first {
            let itemRequest = fetchRequestForMainBudgetTransactions(budget: budget)

            let transactions = results(for: itemRequest)

            var holdingTotal = 0.0
            transactions.forEach { transaction in
                holdingTotal += transaction.wrappedAmount
            }

            let percentageOfDays: Double

            let calendar = Calendar.current

            if budget.type == 1 {
                let components = calendar.dateComponents([.minute], from: budget.startDate!, to: Date.now)
                percentageOfDays = Double(components.minute!) / 1440
            } else {
                let components1 = calendar.dateComponents([.day], from: budget.startDate!, to: budget.endDate)
                let numberOfDays = components1.day!

                let components2 = calendar.dateComponents([.day], from: budget.startDate!, to: Date.now)
                let numberOfDaysPast = components2.day!

                percentageOfDays = Double(numberOfDaysPast) / Double(numberOfDays)
            }

            return (true, holdingTotal, budget.amount, percentageOfDays, Int(budget.type), budget.startDate!)

        } else {
            return (false, 0, 0, 0, 0, Date.now)
        }
    }

    /// Runs `work` against a copy of this repository bound to a background
    /// context, so callers hop threads once instead of repeating the plumbing.
    private func onBackground<T>(_ work: @escaping (BudgetRepository) throws -> T) async rethrows -> T {
        let dataController = self.dataController
        return try await dataController.performBackground { context in
            try work(BudgetRepository(dataController: dataController, context: context))
        }
    }

    func getBudgetLeftover(budget: Budget? = nil, overallBudget: MainBudget? = nil) async throws -> Double {
        // Managed objects must not cross into the background context; carry their
        // IDs across the boundary and rematerialize them inside it.
        let budgetID = budget?.objectID
        let overallBudgetID = overallBudget?.objectID
        return try await onBackground { repository in
            let budget = budgetID.flatMap { (try? repository.context.existingObject(with: $0)) as? Budget }
            let overallBudget = overallBudgetID.flatMap { (try? repository.context.existingObject(with: $0)) as? MainBudget }
            // A failed rematerialization must not fall through to the nil/nil
            // branch, whose unfiltered zero-amount fetch would return the negated
            // sum of every transaction in the store.
            if (budgetID != nil && budget == nil) || (overallBudgetID != nil && overallBudget == nil) {
                throw CustomError.notFound
            }
            return repository.getBudgetLeftover(budget: budget, overallBudget: overallBudget)
        }
    }

    func getMainBudgetWidgetSnapshot() async -> (found: Bool, totalSpent: Double, budgetAmount: Double, percentage: Double, type: Int, startDate: Date) {
        await onBackground { $0.fetchRequestForMainBudgetWidget() }
    }

    /// Value-type view of one budget for the budget widgets: the spent total plus
    /// the fields their date math and rendering need.
    struct WidgetSnapshot: Equatable {
        let totalSpent: Double
        let type: Int
        let symbol: CategorySymbol
        let name: String
        let color: String
        let budgetAmount: Double
        let startDate: Date
        let endDate: Date
    }

    func getWidgetSnapshot(identifier: String) throws -> WidgetSnapshot {
        // The widget configuration stores the budget's objectID URI. A budget
        // deleted since then must surface as notFound, never as a broadened fetch.
        guard let objectIDURL = URL(string: identifier),
              let objectID = dataController.container.persistentStoreCoordinator.managedObjectID(forURIRepresentation: objectIDURL),
              let budget = (try? context.existingObject(with: objectID)) as? Budget
        else {
            throw CustomError.notFound
        }

        // CloudKit can commit a Budget row before its attributes arrive; a
        // half-synced budget must surface as notFound, not crash the widget
        // process on a force-unwrap.
        guard let startDate = budget.startDate, budget.category != nil else {
            throw CustomError.notFound
        }

        let transactions = results(for: fetchRequestForBudgetTransactions(budget: budget))

        var totalSpent = 0.0

        transactions.forEach { transaction in
            totalSpent += transaction.wrappedAmount
        }

        return WidgetSnapshot(
            totalSpent: totalSpent,
            type: Int(budget.type),
            symbol: budget.displaySymbol,
            name: budget.wrappedName,
            color: budget.wrappedColor,
            budgetAmount: budget.amount,
            startDate: startDate,
            endDate: budget.endDate
        )
    }

    /// Resolves the configured budget and sums its transactions on the background
    /// context, so widget timeline callbacks never touch the view context.
    func getWidgetSnapshot(identifier: String) async throws -> WidgetSnapshot {
        try await onBackground { try $0.getWidgetSnapshot(identifier: identifier) }
    }

    struct WidgetOption {
        let identifier: String
        let name: String
    }

    func getWidgetBudgetOptions() -> [WidgetOption] {
        let request = fetchRequestForBudgets()
        // The configuration list is user-visible; mirror the app's budget-list
        // order instead of the store's arbitrary unsorted order.
        request.sortDescriptors = [NSSortDescriptor(key: "dateCreated", ascending: true)]
        return results(for: request).map {
            WidgetOption(identifier: $0.objectID.uriRepresentation().absoluteString, name: $0.wrappedName)
        }
    }

    func getWidgetBudgetOptions() async -> [WidgetOption] {
        await onBackground { $0.getWidgetBudgetOptions() }
    }
}
