//
//  EmojiTextField.swift
//  Outlayr
//
//  The emoji browser, grid cells, and emoji-keyboard bridge shared by the
//  category and transaction identity pickers. Extracted from CategoryAlerts.swift
//  (private → internal) so both sheets render the same palette chrome.
//

import SwiftUI
import UIKit

/// A `UITextField` subclass that forces the emoji keyboard and hides the caret.
/// SwiftUI has no native way to restrict input to the emoji keyboard, so this
/// thin `UIViewRepresentable` bridge is the sanctioned escape hatch.
final class UIEmojiTextField: UITextField {
    override var textInputMode: UITextInputMode? {
        .activeInputModes.first { $0.primaryLanguage == "emoji" }
    }

    override func caretRect(for _: UITextPosition) -> CGRect {
        .zero
    }
}

struct EmojiTextField: UIViewRepresentable {
    @Binding var text: String
    var autoFocus: Bool = true
    var onEndEditing: () -> Void = {}

    func makeUIView(context: Context) -> UIEmojiTextField {
        let field = UIEmojiTextField()
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        field.text = text
        field.delegate = context.coordinator
        field.textAlignment = .center
        if autoFocus {
            field.becomeFirstResponder()
        }
        return field
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, onEndEditing: onEndEditing)
    }

    func updateUIView(_ uiView: UIEmojiTextField, context: Context) {
        context.coordinator.onEndEditing = onEndEditing
        if uiView.text != text {
            uiView.text = text
        }
    }

    /// Holds the binding rather than the parent struct: SwiftUI recreates the
    /// representable on every update, so a captured copy goes stale immediately.
    final class Coordinator: NSObject, UITextFieldDelegate {
        private let text: Binding<String>
        var onEndEditing: () -> Void

        init(text: Binding<String>, onEndEditing: @escaping () -> Void) {
            self.text = text
            self.onEndEditing = onEndEditing
        }

        func textFieldDidChangeSelection(_ textField: UITextField) {
            // Only the newest emoji survives: the field is a picker, not an input.
            let latest = String((textField.text ?? "").onlyEmoji().suffix(1))
            textField.text = latest
            text.wrappedValue = latest
        }

        func textFieldDidEndEditing(_: UITextField) {
            // Dismissing the keyboard without picking must re-arm the "More" cell,
            // which stays disabled while the focus flag is stuck on.
            onEndEditing()
        }
    }
}
