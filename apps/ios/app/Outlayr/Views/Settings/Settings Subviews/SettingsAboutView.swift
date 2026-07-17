//
//  SettingsAboutView.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/11/23.
//

import Foundation
import SwiftUI

struct SettingsAboutView: View {
  @Environment(\.openURL) var openURL

  private let dimeRepo = URL(string: "https://github.com/rafsoh/dimeApp")!
  private let outlayrRepo = URL(string: "https://github.com/danestves/outlayr")!
  private let license = URL(string: "https://www.gnu.org/licenses/gpl-3.0.html")!

  var body: some View {
    List {
      Section {
        Text(
          "Outlayr is open source and free forever. It is built on the foundation of Dime, a beautiful expense tracker created by Rafael Soh, and is distributed under the GNU General Public License v3.0."
        )
        .font(.system(.subheadline, design: .rounded))
        .foregroundStyle(Color.PrimaryText)
        .fixedSize(horizontal: false, vertical: true)
      }

      Section {
        linkRow(icon: "chevron.left.forwardslash.chevron.right", title: "Outlayr on GitHub", url: outlayrRepo)
        linkRow(icon: "heart.fill", title: "Dime (original project)", url: dimeRepo)
        linkRow(icon: "doc.text.fill", title: "GPL-3.0 License", url: license)
      }

      // GPL-3.0 section 0 requires the interactive UI to carry a copyright
      // notice, the no-warranty statement, the right to convey, and how to
      // read the license. Section 5(a) requires marking the work modified
      // and dating it. This block is where the app discharges that.
      Section {
        VStack(alignment: .leading, spacing: 8) {
          Text("Outlayr is a modified version of Dime, forked in 2026 and changed since.")

          Text("Copyright © 2022–2023 Rafael Soh and Dime contributors.\nModifications copyright © 2026 Daniel Esteves.")

          Text(
            "Outlayr comes with ABSOLUTELY NO WARRANTY, to the extent permitted by law. You may redistribute it under the terms of the GNU General Public License v3.0."
          )
        }
        .font(.system(.footnote, design: .rounded).weight(.medium))
        .foregroundStyle(Color.SubtitleText)
        .fixedSize(horizontal: false, vertical: true)
      }
    }
    .listStyle(.insetGrouped)
    .navigationTitle("About & Credits")
    .navigationBarTitleDisplayMode(.inline)
    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
  }

  @ViewBuilder
  private func linkRow(icon: String, title: String, url: URL) -> some View {
    Button {
      openURL(url)
    } label: {
      HStack(spacing: 12) {
        Image(systemName: icon)
          .font(.system(.subheadline, design: .rounded))
          .foregroundStyle(Color.SubtitleText)
          .frame(width: 26, alignment: .center)

        Text(title)
          .font(.system(.body, design: .rounded).weight(.medium))
          .foregroundStyle(Color.PrimaryText)

        Spacer()

        Image(systemName: "arrow.up.right")
          .font(.system(.subheadline, design: .rounded))
          .foregroundStyle(Color.DarkIcon.opacity(0.6))
      }
      .contentShape(Rectangle())
    }
  }
}
