//
//  CategoryTextFields.swift
//  Outlayr
//

import Combine
import CoreHaptics
import Popovers
import SwiftUI
import UIKit

class UIEmojiTextField: UITextField {
    override var textInputMode: UITextInputMode? {
        .activeInputModes.first(where: { $0.primaryLanguage == "emoji" })
    }

    override func caretRect(for _: UITextPosition) -> CGRect {
        return CGRect.zero
    }
}

struct EmojiTextField: UIViewRepresentable {
    @Binding var text: String
    var placeholder: String = ""

    func makeUIView(context: Context) -> UIEmojiTextField {
        let emojiTextField = UIEmojiTextField()
        emojiTextField.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        emojiTextField.placeholder = placeholder
        emojiTextField.text = text
        emojiTextField.delegate = context.coordinator
        emojiTextField.font = UIFont(name: "HelveticaNeue", size: 50)
        emojiTextField.textAlignment = .center
        emojiTextField.endFloatingCursor()
        emojiTextField.becomeFirstResponder()
        return emojiTextField
    }

    func updateUIView(_ uiView: UIEmojiTextField, context _: Context) {
        uiView.text = text
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    class Coordinator: NSObject, UITextFieldDelegate {
        var parent: EmojiTextField

        init(parent: EmojiTextField) {
            self.parent = parent
        }

        func textFieldDidChangeSelection(_ textField: UITextField) {
            DispatchQueue.main.async { [weak self] in
                self?.parent.text = textField.text ?? ""
            }
        }
    }
}

struct NormalTextField: UIViewRepresentable {
    @Binding var text: String
    var placeholder: String = ""
    var action: () -> Void

    func makeUIView(context: Context) -> UITextField {
        let textField = UITextField(frame: .zero)
        textField.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        textField.placeholder = placeholder
        textField.autocapitalizationType = .words
        textField.text = text
        textField.delegate = context.coordinator

        textField.font = UIFont.roundedSpecial(ofStyle: .title2, weight: .medium, size: 17)
//
//        UIFont.rounded(ofSize: 20, weight: .medium)
        return textField
    }

    func updateUIView(_ uiView: UITextField, context _: Context) {
        uiView.text = text
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    class Coordinator: NSObject, UITextFieldDelegate {
        var parent: NormalTextField

        init(parent: NormalTextField) {
            self.parent = parent
        }

        func textFieldDidChangeSelection(_ textField: UITextField) {
            DispatchQueue.main.async { [weak self] in
                self?.parent.text = textField.text ?? ""
            }
        }

        func textFieldShouldReturn(_: UITextField) -> Bool {
            parent.action()

            return true
        }
    }
}
