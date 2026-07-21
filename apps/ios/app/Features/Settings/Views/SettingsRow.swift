//
//  SettingsRow.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import Foundation
import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI

struct SettingsRow: View {
  var icon: String
  var color: Int
  var title: String
  var value: String?

  var body: some View {
    HStack(spacing: 12) {
      HugeiconsText(icon, font: HugeiconsSolidRounded.hugeiconsFont(size: 18), color: .white)
        .frame(width: 29, height: 29)
        .background(Color("\(color)"), in: RoundedRectangle(cornerRadius: 7, style: .continuous))

      Text(LocalizedStringKey(title))
        .foregroundStyle(Color.PrimaryText)

      if let value {
        Spacer(minLength: 8)
        Text(value)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
  }
}
