import SwiftUI

struct AmountEntry {
    var whole = ""
    var fraction: String?

    private static let int32SafeDigits = 9

    func units(_ money: WatchSnapshot.Money) -> Int {
        let cents = (fraction ?? "").padding(toLength: money.minorUnits, withPad: "0", startingAt: 0)
        return (Int(whole) ?? 0) * money.scale + (Int(cents) ?? 0)
    }

    mutating func type(_ digit: Int, _ money: WatchSnapshot.Money) {
        if let fraction {
            guard fraction.count < money.minorUnits else { return }
            self.fraction = fraction + String(digit)
        } else if whole == "0" {
            whole = String(digit)
        } else if whole.count < Self.int32SafeDigits - money.minorUnits {
            whole += String(digit)
        }
    }

    mutating func point(_ money: WatchSnapshot.Money) {
        guard money.minorUnits > 0, fraction == nil else { return }
        if whole.isEmpty { whole = "0" }
        fraction = ""
    }

    mutating func backspace() {
        if let fraction {
            self.fraction = fraction.isEmpty ? nil : String(fraction.dropLast())
        } else {
            whole = String(whole.dropLast())
        }
    }

    func display(_ money: WatchSnapshot.Money) -> (typed: String, ghost: String) {
        let zeros = { (count: Int) in String(repeating: "0", count: max(count, 0)) }
        let cents = money.minorUnits > 0 ? money.decimal + zeros(money.minorUnits) : ""
        guard !whole.isEmpty else { return (money.symbol, "0" + cents) }
        let typed = money.symbol + money.grouped(whole)
        guard let fraction else { return (typed, cents) }
        return (typed + money.decimal + fraction, zeros(money.minorUnits - fraction.count))
    }
}

struct LogFlow: View {
    let snapshot: WatchSnapshot
    let recent: [String]
    let commit: (WatchWrite) -> Void
    @Environment(\.isLuminanceReduced) private var dimmed
    @State private var money: WatchSnapshot.Money
    @State private var entry = AmountEntry()
    @State private var picking = false
    @State private var saved = false

    init(snapshot: WatchSnapshot, recent: [String], commit: @escaping (WatchWrite) -> Void) {
        self.snapshot = snapshot
        self.recent = recent
        self.commit = commit
        _money = State(initialValue: snapshot.money)
    }

    var body: some View {
        NavigationStack {
            AmountView(entry: $entry, money: money) { picking = true }
                .navigationDestination(isPresented: $picking) {
                    CategoryView(
                        snapshot: snapshot,
                        recent: recent,
                        title: money.format(units: entry.units(money)),
                        pick: save
                    )
                }
        }
        .redacted(reason: dimmed ? .privacy : [])
        .onAppear {
            #if DEBUG
            if Demo.step != nil {
                entry = AmountEntry(whole: "18", fraction: "4")
            }
            if Demo.step == "category" {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { picking = true }
            }
            #endif
        }
    }

    private func save(_ category: WatchSnapshot.Category) {
        guard !saved else { return }
        saved = true
        commit(
            WatchWrite(
                id: UUID().uuidString,
                amount: Double(entry.units(money)) / Double(money.scale),
                income: category.income,
                note: "",
                category: category.name,
                categoryId: category.id,
                date: Date().timeIntervalSince1970 * 1000
            )
        )
    }
}

struct AmountView: View {
    @Binding var entry: AmountEntry
    let money: WatchSnapshot.Money
    let done: () -> Void

    private let rows = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

    var body: some View {
        let shown = entry.display(money)
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Text("\(shown.typed)\(Text(shown.ghost).foregroundStyle(Grid.ghost))")
                    .font(Grid.mono(30, medium: true))
                    .foregroundStyle(Grid.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .privacySensitive()
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button {
                    Haptic.click()
                    entry.backspace()
                } label: {
                    Image(systemName: "delete.left")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(Grid.muted)
                        .frame(width: 34, height: 30)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            ForEach(rows, id: \.self) { row in
                HStack(spacing: 4) {
                    ForEach(row, id: \.self) { digit in
                        key(Text("\(digit)")) { entry.type(digit, money) }
                    }
                }
            }
            HStack(spacing: 4) {
                if money.minorUnits > 0 {
                    key(Text(money.decimal).foregroundStyle(Grid.muted)) { entry.point(money) }
                } else {
                    Color.clear.frame(maxWidth: .infinity)
                }
                key(Text("0")) { entry.type(0, money) }
                Button(action: done) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Grid.inkOnPaper)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Grid.paper))
                }
                .buttonStyle(.plain)
                .disabled(entry.units(money) == 0)
                .opacity(entry.units(money) == 0 ? 0.4 : 1)
            }
        }
        .padding(.horizontal, 2)
        .containerBackground(.black, for: .navigation)
    }

    private func key(_ label: Text, action: @escaping () -> Void) -> some View {
        Button {
            Haptic.click()
            action()
        } label: {
            label
                .font(Grid.mono(20, medium: true))
                .foregroundStyle(Grid.ink)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(RoundedRectangle(cornerRadius: 10).fill(Grid.key))
        }
        .buttonStyle(.plain)
    }
}

struct CategoryView: View {
    let snapshot: WatchSnapshot
    let recent: [String]
    let title: String
    let pick: (WatchSnapshot.Category) -> Void

    var body: some View {
        let expenses = snapshot.categories.filter { !$0.income }
        let byId = Dictionary(expenses.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let recents = Array(recent.compactMap { byId[$0] }.prefix(3))
        let recentIds = Set(recents.map(\.id))
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                section(snapshot.labels.recent, recents)
                section(snapshot.labels.all ?? "", expenses.filter { !recentIds.contains($0.id) })
                section(snapshot.labels.income, snapshot.categories.filter(\.income))
            }
            .padding(.horizontal, 6)
        }
        .navigationTitle {
            Text(title).font(Grid.mono(13)).foregroundStyle(Grid.muted).privacySensitive()
        }
        .containerBackground(.black, for: .navigation)
    }

    @ViewBuilder
    private func section(_ name: String, _ categories: [WatchSnapshot.Category]) -> some View {
        if !categories.isEmpty {
            Kicker(name).padding(.top, 10).padding(.bottom, 4)
            Hairline()
            ForEach(categories) { category in
                Button {
                    pick(category)
                } label: {
                    HStack(spacing: 10) {
                        CategoryMark(emoji: category.emoji, color: category.color).frame(width: 22)
                        Text(category.name)
                            .font(.system(size: 17))
                            .foregroundStyle(Grid.ink)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 11)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Hairline()
            }
        }
    }
}
