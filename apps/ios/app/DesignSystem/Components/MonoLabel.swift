//
//  MonoLabel.swift
//  Outlayr
//

import SwiftUI

/// Grid's label voice: monospaced, uppercase, widely tracked, quiet. It names
/// a figure without competing with it, which is what lets the figures alongside
/// carry no chrome of their own.
struct MonoLabel: View {
    private let content: Text
    private let color: Color

    init(_ key: LocalizedStringKey, color: Color = Color.SubtitleText) {
        self.init(Text(key), color: color)
    }

    init(verbatim: String, color: Color = Color.SubtitleText) {
        self.init(Text(verbatim: verbatim), color: color)
    }

    init(_ content: Text, color: Color = Color.SubtitleText) {
        self.content = content
        self.color = color
    }

    var body: some View {
        content
            .font(.system(.caption2, design: .monospaced).weight(.semibold))
            .tracking(1.2)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }
}
