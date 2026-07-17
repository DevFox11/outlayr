//
//  SettingsNumberEntryView.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/11/23.
//

import Foundation
import SwiftUI

struct SettingsNumberEntryView: View {
  @AppStorage("numberEntryType", store: AppIdentifiers.sharedDefaults)
  var numberEntryType: Int = 1

  var body: some View {
    List {
      Section {
        optionRow("Type 1", tag: 1)
        optionRow("Type 2", tag: 2)
      } footer: {
        Text(
          numberEntryType == 1
            ? "\"Pre-dotted\" - If you're too lazy to add a decimal point, I gotchu covered."
            : "\"Cent-less\" - If your transactions usually amount to whole numbers, this one is for you."
        )
      }
    }
    .listStyle(.insetGrouped)
    .navigationTitle("Number Entry Method")
    .navigationBarTitleDisplayMode(.inline)
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
  }

  @ViewBuilder
  private func optionRow(_ title: LocalizedStringKey, tag: Int) -> some View {
    HStack {
      Text(title)
        .foregroundStyle(Color.PrimaryText)

      Spacer()

      if numberEntryType == tag {
        Image(systemName: "checkmark")
          .font(.body.weight(.semibold))
          .foregroundStyle(.tint)
      }
    }
    .contentShape(Rectangle())
    .onTapGesture {
      numberEntryType = tag
    }
  }
}
