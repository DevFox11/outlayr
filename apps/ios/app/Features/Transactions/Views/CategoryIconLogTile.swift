//
//  CategoryIconLogTile.swift
//  Outlayr
//

import CoreData
import Foundation
import HugeiconsCore
import HugeiconsSolidRounded
import SwiftUI

/// The transaction-log variant of the category glyph: unlike `CategoryIconTile`
/// it models the `future` stroke state and sizes itself from padding rather than
/// a fixed frame.
struct CategoryIconLogTile: View {
    enum Scale {
        case row
        case hero

        var glyph: CGFloat {
            switch self {
            case .row: 20
            case .hero: 40
            }
        }

        var radius: CGFloat {
            switch self {
            case .row: 9
            case .hero: 20
            }
        }
    }

    let symbol: CategorySymbol
    let colour: String
    let future: Bool
    let scale: Scale
    /// When present, a stored photo identity renders as a circular thumbnail in
    /// place of the glyph. Decoded once and cached (see `TransactionThumbnailCache`).
    let imageData: Data?
    let imageCacheKey: NSManagedObjectID?

    @Environment(\.colorScheme) private var colorScheme
    @State private var thumbnail: UIImage?

    private var tint: Color { Color(hex: colour) }

    private var thumbnailSide: CGFloat { scale.glyph + 16 }

    /// Re-runs the decode task whenever the identity bytes change.
    private var thumbnailToken: String {
        "\(imageCacheKey?.uriRepresentation().absoluteString ?? "none")-\(imageData?.count ?? 0)-\(Int(thumbnailSide))"
    }

    var body: some View {
        ZStack {
            if let thumbnail {
                Image(uiImage: thumbnail)
                    .resizable()
                    .scaledToFill()
                    .frame(width: thumbnailSide, height: thumbnailSide)
                    .clipShape(Circle())
                    .overlay { Circle().strokeBorder(tint.opacity(future ? 0.73 : 0.2), lineWidth: future ? 2 : 1) }
            } else {
                glyphTile
            }
        }
        .opacity(future ? 0.6 : 1)
        .task(id: thumbnailToken) { await loadThumbnail() }
    }

    /// Decodes the photo thumbnail off the main thread (with a synchronous cache
    /// hit for already-decoded rows, so scrolling back doesn't flash the glyph).
    private func loadThumbnail() async {
        guard let imageData, !imageData.isEmpty else {
            thumbnail = nil
            return
        }
        let side = thumbnailSide
        let key = imageCacheKey
        // UIScreen access must stay on the main actor; capture before detaching.
        let screenScale = UIScreen.main.scale
        if let cached = TransactionThumbnailCache.shared.cached(for: imageData, key: key, side: side) {
            thumbnail = cached
            return
        }
        let decoded = await Task.detached(priority: .userInitiated) {
            TransactionThumbnailCache.shared.decodeAndStore(for: imageData, key: key, side: side, scale: screenScale)
        }.value
        guard !Task.isCancelled else { return }
        thumbnail = decoded
    }

    @ViewBuilder
    private var glyphTile: some View {
        ZStack {
            if future {
                RoundedRectangle(cornerRadius: scale.radius, style: .continuous)
                    .stroke(tint.opacity(0.73), lineWidth: 2)
                    .foregroundStyle(.clear)
            } else {
                // A monochrome glyph needs a pale wash behind it to stay legible;
                // the palette's lighter hues vanish against a saturated fill.
                RoundedRectangle(cornerRadius: scale.radius, style: .continuous)
                    .fill(tint.opacity(0.18))
            }

            switch symbol {
            case let .icon(icon):
                HugeIcon(
                    codepoint: icon.codepoint,
                    font: HugeiconsSolidRounded.font(size: scale.glyph),
                    color: CategoryTileShading.glyph(for: tint, in: colorScheme, washOpacity: 0.18)
                )
                .padding(8)
            case let .emoji(emoji):
                Text(emoji)
                    .font(.system(size: scale.glyph))
                    .padding(8)
            }
        }
    }

    init(icon: CategoryIcon, colour: String, future: Bool, scale: Scale = .row) {
        self.init(symbol: .icon(icon), colour: colour, future: future, scale: scale)
    }

    init(
        symbol: CategorySymbol,
        colour: String,
        future: Bool,
        scale: Scale = .row,
        imageData: Data? = nil,
        imageCacheKey: NSManagedObjectID? = nil
    ) {
        self.symbol = symbol
        self.colour = colour
        self.future = future
        self.scale = scale
        self.imageData = imageData
        self.imageCacheKey = imageCacheKey
    }
}
