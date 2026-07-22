//
//  LogFilterChipRow.swift
//  Outlayr
//

import Foundation
import SwiftUI

/// The active filter, present only while there is one. Everything the old
/// header reserved sixty points for — the day, week and month steppers, the
/// category strip, the expense/income toggle — folds into the chip's own menu,
/// so an unfiltered Log spends no vertical space on a control that isn't there.
struct LogFilterChipRow: View {
    let filter: FilterType
    /// What the filter is scoped to, already resolved by the screen so the chip
    /// and the navigation subtitle can never disagree.
    let detail: String?

    @Binding var categoryFilter: Category?
    @Binding var cursor: Date
    @Binding var income: Bool
    let clear: () -> Void

    @Environment(DataController.self) private var dataController

    @State private var categories: [Category] = []

    private var calendar: Calendar { LogPeriodCursor.appCalendar }

    private var hasMenu: Bool {
        filter.periodUnit != nil || filter == .category || filter == .type
    }

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 9) {
                if hasMenu {
                    Menu {
                        menuContent
                    } label: {
                        chipLabel
                    }
                } else {
                    chipLabel
                }

                Button(action: clear) {
                    Image(systemName: "xmark")
                        .font(.system(.caption2, design: .rounded).weight(.bold))
                        .foregroundStyle(Color.SubtitleText)
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(String(localized: "accessibility.removeFilter"))
            }
            .padding(.vertical, 6)
            .padding(.horizontal, 12)
            .background(Color.SecondaryBackground, in: Capsule())

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .task(id: filter) {
            guard filter == .category else { return }
            await loadCategories()
        }
    }

    /// Falls back to the filter's own name: a chip has to say what it is even
    /// before the thing it is scoped to has resolved.
    private var chipTitle: Text {
        if let detail, !detail.isEmpty {
            return Text(verbatim: detail)
        }
        return Text(LocalizedStringKey(filter.rawValue))
    }

    private var chipLabel: some View {
        HStack(spacing: 5) {
            chipTitle
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(Color.PrimaryText)
                .lineLimit(1)

            if hasMenu {
                Image(systemName: "chevron.down")
                    .font(.system(.caption2, design: .rounded).weight(.bold))
                    .foregroundStyle(Color.SubtitleText)
            }
        }
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var menuContent: some View {
        switch filter {
        case .day, .week, .month:
            stepperMenu

        case .category:
            Picker(selection: $categoryFilter) {
                ForEach(categories, id: \.self) { category in
                    Text(category.wrappedName).tag(Optional(category))
                }
            } label: {
                Text("filter-tag-category")
            }
            .pickerStyle(.inline)

        case .type:
            Picker(selection: $income) {
                Text("Expense").tag(false)
                Text("filter-picker-income").tag(true)
            } label: {
                Text("filter-tag-type")
            }
            .pickerStyle(.inline)

        case .all, .recurring, .upcoming:
            EmptyView()
        }
    }

    @ViewBuilder
    private var stepperMenu: some View {
        if let unit = filter.periodUnit {
            let current = LogPeriodCursor(unit: unit, containing: cursor, calendar: calendar)

            Button {
                cursor = current.stepped(by: -1, calendar: calendar).date
            } label: {
                Label("Earlier", systemImage: "chevron.left")
            }

            Button {
                cursor = current.stepped(by: 1, calendar: calendar).date
            } label: {
                Label("Later", systemImage: "chevron.right")
            }
            .disabled(!current.canStepForward(now: Date.now, calendar: calendar))

            Divider()

            Button {
                cursor = LogPeriodCursor(unit: unit, containing: Date.now, calendar: calendar).date
            } label: {
                Label("Now", systemImage: "arrow.uturn.backward")
            }
        }
    }

    private func loadCategories() async {
        let expenses = dataController.results(for: dataController.categories.fetchRequestForTopLevelCategories(income: false))
        let incomes = dataController.results(for: dataController.categories.fetchRequestForTopLevelCategories(income: true))
        categories = expenses + incomes

        if categoryFilter == nil || !categories.contains(where: { $0 == categoryFilter }) {
            categoryFilter = categories.first
        }
    }
}
