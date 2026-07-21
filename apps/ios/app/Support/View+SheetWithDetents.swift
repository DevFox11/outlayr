//
//  View+SheetWithDetents.swift
//  Outlayr
//
//  Created by Rafael Soh on 1/7/23.
//

import SwiftUI
import UIKit

// 3 - Create extension on View that makes it easier to use the custom modifier
extension View {
    func sheetWithDetents<Content>(
        isPresented: Binding<Bool>,
        detents: [UISheetPresentationController.Detent],
        onDismiss: (() -> Void)?,
        content: @escaping () -> Content
    ) -> some View where Content: View {
        modifier(
            SheetWithDetentsViewModifier(
                isPresented: isPresented,
                detents: detents,
                onDismiss: onDismiss,
                content: content
            )
        )
    }
}
