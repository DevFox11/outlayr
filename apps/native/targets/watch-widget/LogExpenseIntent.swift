import AppIntents

enum LogTarget: String, AppEnum {
    case amount

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Screen"

    static var caseDisplayRepresentations: [LogTarget: DisplayRepresentation] = [
        .amount: "Amount"
    ]
}

struct LogExpenseIntent: OpenIntent {
    static var title: LocalizedStringResource = "Log expense"

    @Parameter(title: "Screen", default: .amount)
    var target: LogTarget

    func perform() async throws -> some IntentResult {
        .result()
    }
}
