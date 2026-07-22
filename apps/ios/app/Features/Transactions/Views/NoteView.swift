//
//  NoteView.swift
//  xpenz
//
//  Created by Rafael Soh on 14/5/22.
//

import Foundation
import SwiftUI

struct NoteView: View {
    @Binding var note: String
    @Binding var focused: Bool

    @FocusState private var textFocused: Bool
    let characterLimit = 50

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var noteWidth: CGFloat {
        let roundedFont = UIFont.roundedSpecial(ofStyle: .body, weight: .semibold, size: 17)
        let attributes = [NSAttributedString.Key.font: roundedFont]

        let size = (note as NSString).size(withAttributes: attributes)
        let placeholder = String(localized: "Add Note")
        let placeholderSize = (placeholder as NSString).size(withAttributes: attributes)

        if !note.isEmpty {
            return size.width + 2
        } else {
            return placeholderSize.width
        }
    }

    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: "text.alignleft")
                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                .foregroundStyle(Color.SubtitleText)

            ZStack(alignment: .leading) {
                TextField("", text: $note)
                    .onChange(of: note) { _, _ in limitText(characterLimit) }
                    .focused($textFocused)
                    .foregroundStyle(Color.PrimaryText)

                if note.isEmpty {
                    Text("Add Note")
                        .foregroundStyle(Color.SubtitleText)
                }
            }
            .font(.system(.body, design: .rounded, weight: .semibold))
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .frame(width: min(noteWidth, UIScreen.main.bounds.width / 1.5), alignment: .center)
        }
        .onTapGesture {
            textFocused = true
        }
        .padding(.vertical, 7)
        .padding(.horizontal, 10)
        .overlay(
            RoundedRectangle(cornerRadius: 11.5, style: .continuous)
                .stroke(Color.Outline, lineWidth: 1.5)
        )
        .onChange(of: textFocused) { _, newValue in
            focused = newValue
        }
    }

    func limitText(_ upper: Int) {
        if note.count > upper {
            note = String(note.prefix(upper))
        }
    }
}
