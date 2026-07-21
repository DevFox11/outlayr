//
//  SettingsCategoryView.swift
//  xpenz
//
//  Created by Rafael Soh on 20/5/22.
//

import Foundation
import SwiftUI

struct SettingsCategoryView: View {
  var body: some View {
    CategoryView(mode: .settings, income: false)
      .background(Color.PrimaryBackground)
  }
}
