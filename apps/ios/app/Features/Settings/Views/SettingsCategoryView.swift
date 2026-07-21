//
//  SettingsCategoryView.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import ConfettiSwiftUI
import Foundation
import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI
import UserNotifications
import WidgetKit

struct SettingsCategoryView: View {
  var body: some View {
    CategoryView(mode: .settings, income: false)
      .background(Color.PrimaryBackground)
  }
}
