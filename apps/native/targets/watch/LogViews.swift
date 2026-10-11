import SwiftUI

struct AmountEntry {
    var units = 0
    var income = false

    func value(_ money: WatchSnapshot.Money) -> Double {
        Double(units) / Double(money.scale)
    }

    mutating func digit(_ digit: Int) {
        guard units < 10_000_000 else { return }
        units = units * 10 + digit
    }

    mutating func backspace() {
        units /= 10
    }

    func signed(_ money: WatchSnapshot.Money) -> String {
        "\(income ? "+" : "−")\(money.format(units: units))"
    }
}

struct LoggedEntry {
    let write: WatchWrite
    let category: WatchSnapshot.Category
}

@Observable
final class LogDraft {
    var entry = AmountEntry()
    var logged: LoggedEntry?

    enum Step: Hashable {
        case category
        case logged
    }

    func reset() {
        entry = AmountEntry()
        logged = nil
    }
}

struct AmountView: View {
    @Bindable var draft: LogDraft
    let snapshot: WatchSnapshot
    let next: () -> Void
    @State private var crown = 0.0

    private let keys = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["+/−", "0", "⌫"]]

    private var entry: AmountEntry {
        get { draft.entry }
        nonmutating set { draft.entry = newValue }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Kicker("\(snapshot.labels.log) · \(snapshot.currency)")
            Text(entry.signed(snapshot.money))
                .font(Grid.mono(28, medium: true))
                .foregroundStyle(entry.income ? Grid.income : Grid.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .contentTransition(.numericText())
            Hairline()
            VStack(spacing: 0) {
                ForEach(keys, id: \.self) { row in
                    HStack(spacing: 0) {
                        ForEach(row, id: \.self) { key in
                            Button {
                                tap(key)
                            } label: {
                                Text(key)
                                    .font(.system(size: 18, weight: .medium))
                                    .foregroundStyle(Grid.ink)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 25)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .overlay(Rectangle().stroke(Grid.hairline, lineWidth: 0.5))
                        }
                    }
                }
            }
            Button(action: next) {
                Text(snapshot.labels.next)
                    .font(.system(size: 16, weight: .semibold))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
            .tint(Grid.paper)
            .foregroundStyle(Grid.inkOnPaper)
            .disabled(entry.units == 0)
            .padding(.top, 2)
        }
        .padding(.horizontal, 4)
        .focusable()
        .digitalCrownRotation(
            $crown,
            from: 0,
            through: 100_000,
            by: 10 / scale,
            sensitivity: .medium,
            isContinuous: false,
            isHapticFeedbackEnabled: true
        )
        .onChange(of: crown) { _, value in
            let units = Int((value * scale).rounded())
            if units != entry.units {
                entry.units = units
            }
        }
        .onChange(of: entry.units) { _, units in
            let value = Double(units) / scale
            if abs(value - crown) > 0.5 / scale {
                crown = value
            }
        }
    }

    private var scale: Double {
        Double(snapshot.money.scale)
    }

    private func tap(_ key: String) {
        Haptic.click()
        switch key {
        case "⌫":
            entry.backspace()
        case "+/−":
            entry.income.toggle()
        default:
            if let digit = Int(key) {
                entry.digit(digit)
            }
        }
    }
}

struct CategoryView: View {
    let categories: [WatchSnapshot.Category]
    let amount: String
    let pick: (WatchSnapshot.Category) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(categories) { category in
                    Button {
                        pick(category)
                    } label: {
                        VStack(spacing: 0) {
                            HStack(spacing: 8) {
                                CategoryMark(emoji: category.emoji, color: category.color).frame(width: 22)
                                Text(category.name)
                                    .font(.system(size: 17))
                                    .foregroundStyle(Grid.ink)
                                    .lineLimit(1)
                                Spacer(minLength: 6)
                                RoundedRectangle(cornerRadius: 1.5)
                                    .fill(Color(css: category.color))
                                    .frame(width: 7, height: 7)
                            }
                            .padding(.vertical, 9)
                            .contentShape(Rectangle())
                            Hairline()
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 6)
        }
        .navigationTitle {
            Text(amount).font(Grid.mono(12)).foregroundStyle(Grid.muted)
        }
    }
}

struct LoggedView: View {
    let logged: LoggedEntry
    let snapshot: WatchSnapshot
    let onNote: (String) -> Void
    let done: () -> Void
    @State private var ruleFraction = 0.0
    @State private var ruleColor = Grid.accent
    @State private var note = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(Grid.ink)
                Kicker(snapshot.labels.logged, color: Grid.ink)
            }
            Hairline()
            HStack(spacing: 8) {
                CategoryMark(emoji: logged.category.emoji, color: logged.category.color).frame(width: 20)
                Text(note.isEmpty ? logged.category.name : note)
                    .font(.system(size: 16))
                    .foregroundStyle(Grid.ink)
                    .lineLimit(1)
                Spacer(minLength: 6)
                Text(amountText)
                    .font(Grid.mono(15))
                    .foregroundStyle(logged.write.income ? Grid.income : Grid.ink)
            }
            .padding(.vertical, 6)
            GeometryReader { geo in
                Rectangle().fill(ruleColor).frame(width: geo.size.width * ruleFraction, height: 1)
            }
            .frame(height: 1)
            HStack(alignment: .top, spacing: 14) {
                figure(snapshot.todayLabel, snapshot.todaySpent, Grid.ink)
                if snapshot.budget.present {
                    figure(
                        snapshot.budget.remainingCaption,
                        snapshot.budget.remaining,
                        snapshot.budget.over ? Grid.over : Grid.ink
                    )
                }
            }
            .padding(.top, 8)
            Spacer()
            HStack(spacing: 6) {
                TextFieldLink(prompt: Text(snapshot.labels.note)) {
                    Label(snapshot.labels.note, systemImage: "mic.fill")
                        .font(.system(size: 15, weight: .semibold))
                } onSubmit: { text in
                    note = text
                    onNote(text)
                }
                .buttonStyle(.bordered)
                Button(action: done) {
                    Text(snapshot.labels.done)
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Grid.paper)
                .foregroundStyle(Grid.inkOnPaper)
            }
        }
        .padding(.horizontal, 6)
        .navigationBarBackButtonHidden(true)
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) { ruleFraction = 1 }
            withAnimation(.easeInOut(duration: 0.6).delay(0.6)) { ruleColor = Grid.hairline }
        }
        .animation(.snappy, value: snapshot.todaySpent)
    }

    private var amountText: String {
        AmountEntry(units: Int((logged.write.amount * Double(snapshot.money.scale)).rounded()), income: logged.write.income)
            .signed(snapshot.money)
    }

    private func figure(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Kicker(label)
            Text(value)
                .font(Grid.mono(22))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .contentTransition(.numericText())
        }
    }
}
