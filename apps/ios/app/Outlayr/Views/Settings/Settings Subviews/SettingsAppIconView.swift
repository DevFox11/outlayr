//
//  SettingsAppIconView.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/11/23.
//

import Foundation
import SwiftUI

struct AppIconBundle: Hashable {
  let actualFileName: String
  let exampleFileName: String
  let displayName: String
  let displaySubtitle: String
}

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

  @State private var position: Int?

  @Namespace var animation

  var body: some View {
    VStack(spacing: 10) {
      Text("App Icon")
        .font(.system(.title3, design: .rounded).weight(.semibold))
        .foregroundStyle(Color.PrimaryText)
        .frame(maxWidth: .infinity)
        .overlay(alignment: .leading) {
          Button {
            self.presentationMode.wrappedValue.dismiss()
          } label: {
            SettingsBackButton()
          }
        }
        .padding(.bottom, 20)

      VStack(spacing: 0) {
        ForEach(options.indices, id: \.self) { index in
          HStack(spacing: 13) {
            Image(options[index].exampleFileName)
              .resizable()
              .aspectRatio(contentMode: .fill)
              .frame(width: 70, height: 70)
              .clipShape(RoundedRectangle(cornerRadius: 18))
              .shadow(color: .black.opacity(0.15), radius: 5, x: 5, y: 5)

            VStack(alignment: .leading, spacing: 3) {
              Text(options[index].displayName)
                .font(.system(.body, design: .rounded))
                .foregroundStyle(Color.PrimaryText)

              Text(options[index].displaySubtitle)
                .font(.system(.caption, design: .rounded))
                .foregroundStyle(Color.SubtitleText)
            }

            Spacer()

            if activeIcon == options[index].actualFileName {
              Image(systemName: "checkmark")
                .font(.system(.subheadline, design: .rounded))
                .foregroundStyle(Color.DarkIcon.opacity(0.6))
                .matchedGeometryEffect(id: "tick", in: animation)
            } else {
              Image(systemName: "checkmark")
                .font(.system(.subheadline, design: .rounded))
                .foregroundStyle(Color.SettingsBackground)
            }
          }
          .frame(maxWidth: .infinity)
          .contentShape(Rectangle())
          .onTapGesture {
            withAnimation {
              activeIcon = options[index].actualFileName
            }
          }
          .padding(.vertical, 15)
          .overlay(alignment: .bottom) {
            if index < (options.count - 1) {
              Divider()
            }
          }
        }
      }
      .padding(.horizontal, 15)
      .background(Color.SettingsBackground, in: RoundedRectangle(cornerRadius: 9))
      .onChange(of: activeIcon) { newValue in
        // "AppIcon" is the primary on Release, so it is absent from CFBundleAlternateIcons
        // there and only nil restores it. Passing the name would fail outside Debug.
        UIApplication.shared.setAlternateIconName(newValue == "AppIcon" ? nil : newValue)
      }
    }
    .modifier(SettingsSubviewModifier())
  }
}
