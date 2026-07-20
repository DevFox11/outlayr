//
//  SymbolBrowsers.swift
//  Outlayr
//
//  The emoji browser, grid cells, and emoji-keyboard bridge shared by the
//  category and transaction identity pickers. Extracted from CategoryAlerts.swift
//  (private → internal) so both sheets render the same palette chrome.
//

import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI
import UIKit

/// The curated emoji palette, grouped to mirror the icon catalogue, with a
/// trailing cell that hands off to the system emoji keyboard.
struct IdentityEmojiBrowser: View {
    let selection: String
    let tint: Color
    var headerBackground: Color = .clear
    let onSelect: (String) -> Void
    let onRequestKeyboard: () -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 10), count: 6)

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 20, pinnedViews: .sectionHeaders) {
            ForEach(CategoryEmojiCatalog.groups) { group in
                Section {
                    LazyVGrid(columns: columns, spacing: 10) {
                        ForEach(group.emojis, id: \.self) { emoji in
                            SymbolEmojiCell(
                                emoji: emoji,
                                tint: tint,
                                isSelected: emoji == selection
                            ) {
                                onSelect(emoji)
                            }
                        }

                        if group.id == CategoryEmojiCatalog.groups.last?.id {
                            keyboardCell
                        }
                    }
                } header: {
                    Text(LocalizedStringKey(group.title))
                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                        .foregroundStyle(Color.SubtitleText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 8)
                        .background(headerBackground)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private var keyboardCell: some View {
        Button(action: onRequestKeyboard) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.SecondaryBackground)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    Image(systemName: "keyboard")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(Color.SubtitleText)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("More emoji")
        .accessibilityHint("Opens the emoji keyboard")
    }
}

struct SymbolEmojiCell: View {
    let emoji: String
    let tint: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isSelected ? tint.opacity(0.18) : Color.SecondaryBackground)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    Text(emoji)
                        .font(.system(size: 26))
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(tint, lineWidth: isSelected ? 2 : 0)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: emoji))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

struct SymbolIconCell: View {
    let icon: CategoryIcon
    let tint: Color
    let isSelected: Bool
    let action: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(action: action) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isSelected ? tint.opacity(0.18) : Color.SecondaryBackground)
                .aspectRatio(1, contentMode: .fit)
                .overlay {
                    HugeIcon(
                        codepoint: icon.codepoint,
                        font: HugeiconsSolidRounded.font(size: 20),
                        color: isSelected
                            ? CategoryTileShading.glyph(for: tint, in: colorScheme, washOpacity: 0.18)
                            : Color.SubtitleText
                    )
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(tint, lineWidth: isSelected ? 2 : 0)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: icon.name))
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Emoji keyboard bridge

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
