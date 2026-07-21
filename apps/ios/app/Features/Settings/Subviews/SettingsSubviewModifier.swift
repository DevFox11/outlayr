//
//  SettingsSubviewModifier.swift
//  Outlayr
//
//  Created by Rafael Soh on 5/11/23.
//

import Foundation
import SwiftUI

struct SettingsSubviewModifier: ViewModifier {
    let title: LocalizedStringKey

    func body(content: Content) -> some View {
        content
            .padding(20)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Color(uiColor: .systemGroupedBackground))
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
    }
}
