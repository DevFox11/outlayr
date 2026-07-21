//
//  SettingsAppIconView.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/11/23.
//

import Foundation
import SwiftUI

struct SettingsAppIconView: View {
  @AppStorage("activeIcon", store: AppIdentifiers.sharedDefaults)
  var activeIcon: String = "AppIcon"
  @Environment(\.presentationMode) var presentationMode: Binding<PresentationMode>

  let options: [AppIconBundle] = [
    AppIconBundle(
      actualFileName: "AppIcon", exampleFileName: "AppIcon_EG", displayName: "Default",
      displaySubtitle: "The Outlayr mark on paper. The icon the app ships with."),
    AppIconBundle(
      actualFileName: "AppIcon1", exampleFileName: "AppIcon1_EG", displayName: "Ink",
      displaySubtitle: "The mark inverted — paper on ink, for darker home screens."),
    AppIconBundle(
      actualFileName: "AppIcon2", exampleFileName: "AppIcon2_EG", displayName: "Hairline",
      displaySubtitle: "Outline only, drawn in a single ink hairline."),
    AppIconBundle(
      actualFileName: "AppIcon3", exampleFileName: "AppIcon3_EG", displayName: "Mono",
      displaySubtitle: "A flat grey field with the ink mark. Quiet and neutral."),
    AppIconBundle(
      actualFileName: "AppIcon4", exampleFileName: "AppIcon4_EG", displayName: "Emboss",
      displaySubtitle: "Paper on paper. The mark reads only in its shadow.")
  ]

  var body: some View {
    List {
      Section {
        ForEach(options.indices, id: \.self) { index in
          iconRow(options[index])
        }
      }
    }
    .listStyle(.insetGrouped)
    .onChange(of: activeIcon) { _, newValue in
      // "AppIcon" is the primary on Release, so it is absent from CFBundleAlternateIcons
      // there and only nil restores it. Passing the name would fail outside Debug.
      UIApplication.shared.setAlternateIconName(newValue == "AppIcon" ? nil : newValue)
    }
    .navigationTitle("App Icon")
    .navigationBarTitleDisplayMode(.inline)
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
  }

  @ViewBuilder
  private func iconRow(_ option: AppIconBundle) -> some View {
    HStack(spacing: 13) {
      Image(option.exampleFileName)
        .resizable()
        .aspectRatio(contentMode: .fill)
        .frame(width: 44, height: 44)
        .clipShape(RoundedRectangle(cornerRadius: 10))

      VStack(alignment: .leading, spacing: 3) {
        Text(option.displayName)
          .font(.system(.body, design: .rounded))
          .foregroundStyle(Color.PrimaryText)

        Text(option.displaySubtitle)
          .font(.system(.caption, design: .rounded))
          .foregroundStyle(Color.SubtitleText)
      }

      Spacer()

      if activeIcon == option.actualFileName {
        Image(systemName: "checkmark")
          .font(.body.weight(.semibold))
          .foregroundStyle(.tint)
      }
    }
    .contentShape(Rectangle())
    .onTapGesture {
      activeIcon = option.actualFileName
    }
  }
}
