//
//  SettingsCloudView.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/11/23.
//

import Foundation
import SwiftUI

struct SettingsCloudView: View {
  @Environment(\.dismiss) var dismiss
  @State private var iCloudStorage: Bool = false

  private var iCloudBinding: Binding<Bool> {
    Binding(
      get: { iCloudStorage },
      set: { newValue in
        iCloudStorage = newValue
        NSUbiquitousKeyValueStore.default.set(newValue, forKey: "icloud_sync")
      }
    )
  }

  var body: some View {
    List {
      Section {
        Toggle("Enable Sync", isOn: iCloudBinding)
          .foregroundStyle(Color.PrimaryText)
      } footer: {
        Text("Close and reload app for change to take effect.")
      }
    }
    .listStyle(.insetGrouped)
    .onAppear {
      iCloudStorage = NSUbiquitousKeyValueStore.default.bool(forKey: "icloud_sync")
    }
    .navigationTitle("iCloud Sync")
    .navigationBarTitleDisplayMode(.inline)
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
  }
}
