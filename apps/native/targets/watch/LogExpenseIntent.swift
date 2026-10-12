import AppIntents
import Observation

enum LogTarget: String, AppEnum {
    case amount

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Screen"

    static var caseDisplayRepresentations: [LogTarget: DisplayRepresentation] = [
        .amount: "Amount"
    ]
}

@Observable
final class LaunchRequest {
    static let shared = LaunchRequest()

    var log = false
}

struct LogExpenseIntent: OpenIntent {
    static var title: LocalizedStringResource = "Log expense"

    @Parameter(title: "Screen", default: .amount)
    var target: LogTarget

    @MainActor
    func perform() async throws -> some IntentResult {
        LaunchRequest.shared.log = true
        return .result()
    }
}
