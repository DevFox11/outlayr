//
//  SettingsWeekStartView.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/11/23.
//

import Foundation
import SwiftUI

struct SettingsWeekStartView: View {
  @AppStorage(DefaultsKey.firstWeekday, store: AppIdentifiers.sharedDefaults)
  var firstWeekday: Int = 1
  @AppStorage(DefaultsKey.firstDayOfMonth, store: AppIdentifiers.sharedDefaults)
  var firstDayOfMonth: Int = 1
  @Environment(\.presentationMode) var presentationMode: Binding<PresentationMode>

  let options = ["Sunday", "Monday"]

  var body: some View {
    List {
      Section("Start of Week") {
        ForEach(options.indices, id: \.self) { option in
          weekdayRow(LocalizedStringKey(options[option]), tag: option + 1)
        }
      }

      Section {
        ForEach(1..<29) { day in
          dayRow(day)
        }
      } header: {
        Text("Start of Month")
      } footer: {
        Text("Close and reload app for change to take effect.")
      }
    }
    .listStyle(.insetGrouped)
    .navigationTitle("Time Frames")
    .navigationBarTitleDisplayMode(.inline)
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
  }

  @ViewBuilder
  private func weekdayRow(_ title: LocalizedStringKey, tag: Int) -> some View {
    Button {
      firstWeekday = tag
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
        self.presentationMode.wrappedValue.dismiss()
      }
    } label: {
      HStack {
        Text(title)
          .foregroundStyle(Color.PrimaryText)

        Spacer()

        if firstWeekday == tag {
          Image(systemName: "checkmark")
            .font(.body.weight(.semibold))
            .foregroundStyle(.tint)
        }
      }
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(firstWeekday == tag ? .isSelected : [])
  }

  @ViewBuilder
  private func dayRow(_ day: Int) -> some View {
    Button {
      firstDayOfMonth = day
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
        self.presentationMode.wrappedValue.dismiss()
      }
    } label: {
      HStack {
        Text("\(getOrdinal(day)) of month")
          .foregroundStyle(Color.PrimaryText)

        Spacer()

        if firstDayOfMonth == day {
          Image(systemName: "checkmark")
            .font(.body.weight(.semibold))
            .foregroundStyle(.tint)
        }
      }
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(firstDayOfMonth == day ? .isSelected : [])
  }

  func getOrdinal(_ number: Int) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .ordinal

    return formatter.string(from: number as NSNumber)!.replacingOccurrences(of: ".", with: "")
  }
}
