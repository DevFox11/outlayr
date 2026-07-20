import SwiftUI

/// Symbols (currency, separators, signs) never roll — they crossfade in place.
struct SymbolSlot: View {
    let text: String

    var body: some View {
        Text(verbatim: text)
            .fixedSize()
            .contentTransition(.opacity)
    }
}
