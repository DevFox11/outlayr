import AppIntents

/// Figures are carried on the entity rather than fetched when it is used: they
/// come from the app's snapshot, already formatted in the user's currency.
struct BudgetEntity: AppEntity {
    let id: String
    let name: String
    let remaining: String
    let remainingCaption: String
    let spent: String
    let limit: String
    let percent: String
    let periodLabel: String

    static var typeDisplayRepresentation = TypeDisplayRepresentation(
        name: "Budget",
        numericFormat: "\(placeholder: .int) budgets"
    )

    static var defaultQuery = BudgetQuery()

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)",
            subtitle: "\(remaining) \(remainingCaption) \(periodLabel)"
        )
    }

    init(from budget: IntentSnapshot.NamedBudget) {
        id = budget.id
        name = budget.name
        remaining = budget.remaining
        remainingCaption = budget.remainingCaption
        spent = budget.spent
        limit = budget.limit
        percent = budget.percent
        periodLabel = budget.periodLabel
    }
}

/// `EntityStringQuery` hands over whatever Siri heard, so the match is case- and
/// diacritic-insensitive and matches either way round: people say "groceries"
/// for a budget they named "Groceries & Household".
struct BudgetQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [BudgetEntity] {
        all().filter { identifiers.contains($0.id) }
    }

    func entities(matching string: String) async throws -> [BudgetEntity] {
        let needle = string.folding(
            options: [.caseInsensitive, .diacriticInsensitive],
            locale: .current
        )
        guard !needle.isEmpty else { return all() }

        return all().filter { entity in
            let name = entity.name.folding(
                options: [.caseInsensitive, .diacriticInsensitive],
                locale: .current
            )
            return name.contains(needle) || needle.contains(name)
        }
    }

    func suggestedEntities() async throws -> [BudgetEntity] {
        all()
    }

    private func all() -> [BudgetEntity] {
        (SharedStore.snapshot()?.budgets ?? []).map(BudgetEntity.init(from:))
    }
}
