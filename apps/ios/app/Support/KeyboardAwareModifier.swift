//
//  KeyboardAwareModifier.swift
//  xpenz
//
//  Created by Rafael Soh on 16/5/22.
//

import Foundation
import SwiftUI
import UIKit

struct KeyboardAwareModifier: ViewModifier {
    @AppStorage(DefaultsKey.keyboard, store: AppIdentifiers.sharedDefaults) var savedKeyboardHeight: Double = .init(UIScreen.main.bounds.height / 2.5)
    var showToolbar: Bool

    func body(content: Content) -> some View {
        content
            .frame(height: savedKeyboardHeight)
            .task {
                for await notification in NotificationCenter.default.notifications(named: UIResponder.keyboardWillShowNotification) {
                    guard let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue else { continue }
                    let height = frame.cgRectValue.height
                    if height > 200 {
                        savedKeyboardHeight = height - 20
                    }
                }
            }
    }
}

extension View {
    func keyboardAwareHeight(showToolbar: Bool) -> some View {
        ModifiedContent(content: self, modifier: KeyboardAwareModifier(showToolbar: showToolbar))
    }
}
