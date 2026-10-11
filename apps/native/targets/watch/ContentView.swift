import SwiftUI

struct ContentView: View {
    @Environment(PhoneLink.self) private var link
    @State private var page = Page.today
    @State private var path: [LogDraft.Step] = []
    @State private var draft = LogDraft()

    enum Page {
        case today
        case log
        case recent
    }

    var body: some View {
        if let snapshot = link.snapshot {
            NavigationStack(path: $path) {
                TabView(selection: $page) {
                    TodayView(snapshot: snapshot).tag(Page.today)
                    AmountView(draft: draft, snapshot: snapshot) {
                        path.append(.category)
                    }
                    .tag(Page.log)
                    RecentView(snapshot: snapshot).tag(Page.recent)
                }
                .tabViewStyle(.verticalPage)
                .navigationDestination(for: LogDraft.Step.self) { step in
                    switch step {
                    case .category:
                        CategoryView(
                            categories: snapshot.categories.filter { $0.income == draft.entry.income },
                            amount: draft.entry.signed(snapshot.money),
                            pick: commit
                        )
                    case .logged:
                        if let logged = draft.logged {
                            LoggedView(
                                logged: logged,
                                snapshot: snapshot,
                                onNote: { link.note(logged.write.id, $0) },
                                done: reset
                            )
                        }
                    }
                }
            }
            .onAppear {
                #if DEBUG
                demo(snapshot)
                #endif
            }
        } else {
            WaitingView()
        }
    }

    private func commit(_ category: WatchSnapshot.Category) {
        guard let money = link.snapshot?.money else { return }
        let write = WatchWrite(
            id: UUID().uuidString,
            amount: draft.entry.value(money),
            income: draft.entry.income,
            note: "",
            category: category.name,
            categoryId: category.id,
            date: Date().timeIntervalSince1970 * 1000
        )
        link.log(write)
        Haptic.success()
        draft.logged = LoggedEntry(write: write, category: category)
        path.append(.logged)
    }

    private func reset() {
        path = []
        draft.reset()
    }

    #if DEBUG
    private func demo(_ snapshot: WatchSnapshot) {
        switch Demo.step {
        case "today": page = .today
        case "recent": page = .recent
        case "amount", "category", "logged":
            page = .log
            draft.entry.units = 1840
        default: return
        }
        if Demo.step == "category" || Demo.step == "logged" {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { path = [.category] }
        }
        if Demo.step == "logged", let category = snapshot.categories.first(where: { !$0.income }) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) { commit(category) }
        }
    }
    #endif
}

struct WaitingView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker("Outlayr")
            Text(Locale.current.language.languageCode == .spanish ? "Abre Outlayr en tu iPhone" : "Open Outlayr on your iPhone")
                .font(.system(size: 16))
                .foregroundStyle(Grid.ink)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.horizontal, 8)
    }
}

#if DEBUG
enum Demo {
    static let step: String? = {
        let arguments = CommandLine.arguments
        guard let index = arguments.firstIndex(of: "-demo"), index + 1 < arguments.count else { return nil }
        return arguments[index + 1]
    }()
}
#endif
