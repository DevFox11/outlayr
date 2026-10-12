import AppIntents
import SwiftUI
import WidgetKit

@available(watchOS 26.0, *)
struct OutlayrLogControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "OutlayrLogControl") {
            ControlWidgetButton(action: LogExpenseIntent()) {
                Label("Log expense", systemImage: "plus")
            }
        }
        .displayName("Log expense")
        .description("Opens Outlayr ready for an amount.")
    }
}
