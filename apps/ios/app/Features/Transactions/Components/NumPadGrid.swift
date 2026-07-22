import SwiftUI

struct NumPadGrid<LeftKey: View>: View {
    let onDigit: (Int) -> Void
    let onLeftKey: () -> Void
    let onSubmit: () -> Void
    @ViewBuilder var leftKeyLabel: (CGSize) -> LeftKey
    var leftKeyAccessibilityLabel: String?
    var digitsDisabled: Bool = false
    var leftKeyDisabled: Bool = false
    let submitBounceValue: Bool

    private let rows = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]

    var body: some View {
        GeometryReader { proxy in
            VStack(spacing: proxy.size.height * 0.04) {
                ForEach(rows, id: \.self) { row in
                    HStack(spacing: proxy.size.width * 0.05) {
                        ForEach(row, id: \.self) { digit in
                            digitButton(digit, proxy: proxy)
                        }
                    }
                }
                HStack(spacing: proxy.size.width * 0.05) {
                    Button(action: onLeftKey) {
                        leftKeyLabel(proxy.size)
                    }
                    .disabled(leftKeyDisabled)
                    .buttonStyle(NumPadButton())
                    .modifier(OptionalAccessibilityLabel(label: leftKeyAccessibilityLabel))

                    digitButton(0, proxy: proxy)

                    Button(action: onSubmit) {
                        Image(systemName: "checkmark.square.fill")
                            .scaledFont(30, weight: .medium, design: .rounded)
                            .symbolEffect(.bounce.up.byLayer, value: submitBounceValue)
                            .frame(width: proxy.size.width * 0.3, height: proxy.size.height * 0.22)
                            .foregroundStyle(Color.LightIcon)
                            .background(
                                Color.DarkBackground,
                                in: RoundedRectangle(cornerRadius: 10, style: .continuous)
                            )
                    }
                    .buttonStyle(NumPadButton())
                    .accessibilityLabel("Submit")
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .padding(.bottom, 15)
    }

    private func digitButton(_ digit: Int, proxy: GeometryProxy) -> some View {
        Button {
            guard !digitsDisabled else { return }
            onDigit(digit)
        } label: {
            Text("\(digit)")
                .scaledFont(34, weight: .regular, design: .rounded)
                .frame(width: proxy.size.width * 0.3, height: proxy.size.height * 0.22)
                .background(Color.SecondaryBackground)
                .foregroundStyle(Color.PrimaryText)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .opacity(digitsDisabled ? 0.6 : 1)
        }
        .disabled(digitsDisabled)
        .buttonStyle(NumPadButton())
    }
}

private struct OptionalAccessibilityLabel: ViewModifier {
    let label: String?
    func body(content: Content) -> some View {
        if let label {
            content.accessibilityLabel(label)
        } else {
            content
        }
    }
}
