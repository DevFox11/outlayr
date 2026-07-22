//
//  WidgetDataStoreUnavailableView.swift
//  Outlayr
//

import SwiftUI
import WidgetKit

/// Placeholder rendered by every widget when the shared Core Data store failed to
/// open (broken app group). Shows an explicit error instead of letting a widget
/// masquerade as working-but-empty. Defined here (a file shared by the app and the
/// widget-extension targets) so `guardedByDataStore()` is visible in both.
struct WidgetDataStoreUnavailableView: View {
    var body: some View {
        Text("Storage unavailable")
            .scaledFont(12, weight: .medium, design: .rounded)
            .multilineTextAlignment(.center)
            .foregroundColor(Color.SubtitleText)
            .padding(8)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .containerBackground(for: .widget) {
                Color.PrimaryBackground
            }
    }
}

extension View {
    /// Refuses to render real widget content when the shared store is unavailable,
    /// showing `WidgetDataStoreUnavailableView` instead of stale/empty data.
    @ViewBuilder
    func guardedByDataStore() -> some View {
        if DataController.storeIsAvailable {
            self
        } else {
            WidgetDataStoreUnavailableView()
        }
    }
}
