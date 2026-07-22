//
//  DataStoreUnavailableView.swift
//  Outlayr
//
//  Created by Rafael Soh on 11/7/22.
//

import SwiftUI

/// Blocking, full-screen error shown when the shared app-group store could not be
/// opened. The app refuses to run against a private, non-shared fallback store
/// rather than silently splitting its data from the widgets and extensions.
struct DataStoreUnavailableView: View {
    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "externaldrive.badge.xmark")
                .scaledFont(46, weight: .semibold)
                .foregroundStyle(.secondary)

            Text("Storage Unavailable")
                .scaledFont(20, weight: .bold, design: .rounded)

            Text("The shared app group container could not be opened, so your data can't be loaded safely. Please relaunch the app. If the problem continues, contact support.")
                .scaledFont(15, weight: .medium, design: .rounded)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
