import SwiftUI

struct ContentView: View {
    @Environment(PhoneLink.self) private var link
    @State private var request = LaunchRequest.shared
    @State private var logging = false

    var body: some View {
        Group {
            if let snapshot = link.snapshot {
                NavigationStack {
                    TodayView(snapshot: snapshot, unsynced: link.unsynced)
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                Button {
                                    logging = true
                                } label: {
                                    Image(systemName: "plus")
                                        .font(.system(size: 20, weight: .semibold))
                                        .foregroundStyle(Grid.inkOnPaper)
                                }
                                .tint(Grid.paper)
                                .buttonStyle(.borderedProminent)
                                .buttonBorderShape(.circle)
                            }
                        }
                }
                .sheet(isPresented: $logging) {
                    LogFlow(snapshot: snapshot, recent: recentCategoryIds(snapshot)) { write in
                        link.log(write)
                        Haptic.success()
                        logging = false
                    }
                }
            } else {
                WaitingView()
            }
        }
        .onOpenURL { url in
            request.log = url.host() == "log"
        }
        .onChange(of: request.log, initial: true) { _, wants in
            guard wants else { return }
            request.log = false
            logging = link.snapshot != nil
        }
        .onAppear {
            #if DEBUG
            if Demo.step == "amount" || Demo.step == "category" {
                logging = true
            }
            #endif
        }
    }

    private func recentCategoryIds(_ snapshot: WatchSnapshot) -> [String] {
        let ids = link.unsynced.map(\.categoryId) + snapshot.entries.compactMap(\.rootCategoryId)
        var seen = Set<String>()
        return ids.filter { seen.insert($0).inserted }
    }
}

struct WaitingView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Kicker("Outlayr")
            Text("Open Outlayr on your iPhone")
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
