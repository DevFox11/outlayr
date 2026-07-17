//
//  CategoryTextFields.swift
//  Outlayr
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

    func makeUIView(context: Context) -> UIEmojiTextField {
        let field = UIEmojiTextField()
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        field.text = text
        field.delegate = context.coordinator
        field.font = UIFont(name: "HelveticaNeue", size: 50)
        field.textAlignment = .center
        if autoFocus {
            field.becomeFirstResponder()
        }
        return field
    }

    func updateUIView(_ uiView: UIEmojiTextField, context _: Context) {
        if uiView.text != text {
            uiView.text = text
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    final class Coordinator: NSObject, UITextFieldDelegate {
        let parent: EmojiTextField

        init(parent: EmojiTextField) {
            self.parent = parent
        }

        func textFieldDidChangeSelection(_ textField: UITextField) {
            let latest = String((textField.text ?? "").onlyEmoji().suffix(1))
            if textField.text != latest {
                textField.text = latest
            }
            DispatchQueue.main.async { [parent] in
                parent.text = latest
            }
        }
    }
}
