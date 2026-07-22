//
//  ShortcutsEntities.swift
//  Outlayr
//
//  Created by Rafael Soh on 1/8/23.
//

import AppIntents
import Foundation

@available(iOS 16, *)
struct IncomeCategoryEntity: AppEntity, Identifiable {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = .init(name: "Category")
    typealias DefaultQueryType = IncomeCategoryQuery
    static var defaultQuery: IncomeCategoryQuery = .init()

    var id: UUID

    @Property(title: "Name")
    var name: String

    @Property(title: "Income")
    var income: Bool

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }

    init(id: UUID, name: String, income: Bool) {
        self.id = id
        self.name = name
        self.income = income
    }
}

@available(iOS 16, *)
struct IncomeCategoryQuery: EntityStringQuery {
    func entities(matching query: String) async throws -> [IncomeCategoryEntity] {
        await MainActor.run {
            DataController.shared.categories.getAllCategories(income: true)
                .filter { $0.wrappedName.localizedCaseInsensitiveContains(query) }
                .compactMap { category in
                    guard let id = category.id else { return nil }
                    return IncomeCategoryEntity(id: id, name: category.wrappedName, income: category.income)
                }
        }
    }

    func entities(for identifiers: [IncomeCategoryEntity.ID]) async throws -> [IncomeCategoryEntity] {
        await MainActor.run {
            identifiers.compactMap { identifier in
                guard let match = try? DataController.shared.categories.findCategory(withId: identifier),
                      let id = match.id else { return nil }
                return IncomeCategoryEntity(id: id, name: match.wrappedName, income: match.income)
            }
        }
    }

    func suggestedEntities() async throws -> [IncomeCategoryEntity] {
        await MainActor.run {
            DataController.shared.categories.getAllCategories(income: true)
                .compactMap { category in
                    guard let id = category.id else { return nil }
                    return IncomeCategoryEntity(id: id, name: category.wrappedName, income: category.income)
                }
        }
    }
}

@available(iOS 16, *)
struct ExpenseCategoryEntity: AppEntity, Identifiable {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = .init(name: "Category")
    typealias DefaultQueryType = ExpenseCategoryQuery
    static var defaultQuery: ExpenseCategoryQuery = .init()

    var id: UUID

    @Property(title: "Name")
    var name: String

    @Property(title: "Income")
    var income: Bool

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }

    init(id: UUID, name: String, income: Bool) {
        self.id = id
        self.name = name
        self.income = income
    }
}

@available(iOS 16, *)
struct ExpenseCategoryQuery: EntityStringQuery {
    func entities(matching query: String) async throws -> [ExpenseCategoryEntity] {
        await MainActor.run {
            DataController.shared.categories.getAllCategories(income: false)
                .filter { $0.wrappedName.localizedCaseInsensitiveContains(query) }
                .compactMap { category in
                    guard let id = category.id else { return nil }
                    return ExpenseCategoryEntity(id: id, name: category.wrappedName, income: category.income)
                }
        }
    }

    func entities(for identifiers: [ExpenseCategoryEntity.ID]) async throws -> [ExpenseCategoryEntity] {
        await MainActor.run {
            identifiers.compactMap { identifier in
                guard let match = try? DataController.shared.categories.findCategory(withId: identifier),
                      let id = match.id else { return nil }
                return ExpenseCategoryEntity(id: id, name: match.wrappedName, income: match.income)
            }
        }
    }

    func suggestedEntities() async throws -> [ExpenseCategoryEntity] {
        await MainActor.run {
            DataController.shared.categories.getAllCategories(income: false)
                .compactMap { category in
                    guard let id = category.id else { return nil }
                    return ExpenseCategoryEntity(id: id, name: category.wrappedName, income: category.income)
                }
        }
    }
}

@available(iOS 16, *)
struct BudgetEntity: AppEntity, Identifiable {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = .init(name: "Budget")
    typealias DefaultQueryType = BudgetQuery
    static var defaultQuery: BudgetQuery = .init()

    var id: UUID

    @Property(title: "Name")
    var name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }

    init(id: UUID, name: String) {
        self.id = id
        self.name = name
    }
}

@available(iOS 16, *)
struct BudgetQuery: EntityStringQuery {
    func entities(matching query: String) async throws -> [BudgetEntity] {
        await MainActor.run {
            DataController.shared.budgets.getAllBudgets()
                .filter { $0.wrappedName.localizedCaseInsensitiveContains(query) }
                .compactMap { budget in
                    guard let id = budget.id else { return nil }
                    return BudgetEntity(id: id, name: budget.wrappedName)
                }
        }
    }

    func entities(for identifiers: [BudgetEntity.ID]) async throws -> [BudgetEntity] {
        await MainActor.run {
            identifiers.compactMap { identifier in
                guard let match = try? DataController.shared.budgets.findBudget(withId: identifier),
                      let id = match.id else { return nil }
                return BudgetEntity(id: id, name: match.wrappedName)
            }
        }
    }

    func suggestedEntities() async throws -> [BudgetEntity] {
        await MainActor.run {
            DataController.shared.budgets.getAllBudgets()
                .compactMap { budget in
                    guard let id = budget.id else { return nil }
                    return BudgetEntity(id: id, name: budget.wrappedName)
                }
        }
    }
}
