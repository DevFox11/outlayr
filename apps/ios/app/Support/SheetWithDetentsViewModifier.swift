//
//  SheetWithDetentsViewModifier.swift
//  Outlayr
//
//  Created by Rafael Soh on 1/7/23.
//

import SwiftUI
import UIKit

// 2 - Create the SwiftUI modifier conforming to the ViewModifier protocol
struct SheetWithDetentsViewModifier<SwiftUIContent>: ViewModifier where SwiftUIContent: View {
    @Binding var isPresented: Bool
    let onDismiss: (() -> Void)?
    let detents: [UISheetPresentationController.Detent]
    let swiftUIContent: SwiftUIContent

    init(isPresented: Binding<Bool>, detents: [UISheetPresentationController.Detent] = [.medium()], onDismiss: (() -> Void)? = nil, content: () -> SwiftUIContent) {
        _isPresented = isPresented
        self.onDismiss = onDismiss
        swiftUIContent = content()
        self.detents = detents
    }

    func body(content: Content) -> some View {
        ZStack {
            SheetPresentationForSwiftUI($isPresented, onDismiss: onDismiss, detents: detents) {
                swiftUIContent
            }.fixedSize()
            content
        }
    }
}
