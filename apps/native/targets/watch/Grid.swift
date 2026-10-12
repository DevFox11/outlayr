import SwiftUI

enum Grid {
    static let ink = Color(hex: 0xF2EF_E8)
    static let muted = Color(hex: 0xA8A0_93)
    static let subtle = Color(hex: 0x968E_80)
    static let hairline = Color(hex: 0x3530_26)
    static let bar = Color(hex: 0x4A46_3E)
    static let ghost = Color(hex: 0x6B66_5C)
    static let key = Color(hex: 0x1C1C_1E)
    static let income = Color(hex: 0x3FD9_9B)
    static let over = Color(hex: 0xF178_79)
    static let accent = Color(hex: 0xEC60_3B)
    static let paper = Color(hex: 0xF2F0_EA)
    static let inkOnPaper = Color(hex: 0x1715_0F)

    static func mono(_ size: CGFloat, medium: Bool = false) -> Font {
        .custom(medium ? "GeistMono-Medium" : "GeistMono-Regular", size: size)
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }

    init(css: String) {
        var value: UInt64 = 0
        let digits = css.hasPrefix("#") ? String(css.dropFirst()) : css
        guard digits.count == 6, Scanner(string: digits).scanHexInt64(&value) else {
            self = Grid.muted
            return
        }
        self.init(hex: UInt32(value))
    }
}

struct Kicker: View {
    let text: String
    var color: Color = Grid.muted

    init(_ text: String, color: Color = Grid.muted) {
        self.text = text
        self.color = color
    }

    var body: some View {
        Text(text.uppercased())
            .font(Grid.mono(11))
            .tracking(1.1)
            .foregroundStyle(color)
            .lineLimit(1)
    }
}

struct Hairline: View {
    var body: some View {
        Rectangle().fill(Grid.hairline).frame(height: 1)
    }
}

struct CategoryMark: View {
    let emoji: String
    let color: String

    var body: some View {
        if emoji.isEmpty {
            RoundedRectangle(cornerRadius: 2).fill(Color(css: color)).frame(width: 10, height: 10)
        } else {
            Text(emoji).font(.system(size: 16))
        }
    }
}

struct EntryRow: View {
    let emoji: String
    let color: String
    let title: String
    let amount: String
    let income: Bool
    let latest: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                CategoryMark(emoji: emoji, color: color).frame(width: 20)
                Text(title).font(.system(size: 16)).foregroundStyle(Grid.ink).lineLimit(1)
                Spacer(minLength: 6)
                Text("\(income ? "+" : "−")\(amount)")
                    .font(Grid.mono(15))
                    .foregroundStyle(income ? Grid.income : Grid.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .privacySensitive()
            }
            .padding(.vertical, 7)
            Rectangle().fill(latest ? Grid.accent : Grid.hairline).frame(height: 1)
        }
    }
}

enum Haptic {
    static func click() { WKInterfaceDevice.current().play(.click) }
    static func success() { WKInterfaceDevice.current().play(.success) }
}
