//
//  TransactionThumbnailCache.swift
//  Outlayr
//

import CloudKitSyncMonitor
import CoreData
import Foundation
import HugeiconsCore
import HugeiconsSolidRounded
import Popovers
import SwiftUI

/// A tiny decode cache for transaction photo thumbnails so scrolling the log
/// doesn't re-decode the same JPEG every row. Keyed by object id plus the stored
/// byte count, so an edited photo (new bytes) misses and re-decodes.
/// NSCache is thread-safe, so both the synchronous peek and the off-main decode
/// touch it directly.
final class TransactionThumbnailCache {
    static let shared = TransactionThumbnailCache()
    private let cache = NSCache<NSString, UIImage>()

    private init() { cache.countLimit = 120 }

    private func key(_ key: NSManagedObjectID?, _ data: Data, _ side: CGFloat) -> NSString {
        "\(key?.uriRepresentation().absoluteString ?? "anon")-\(data.count)-\(Int(side))" as NSString
    }

    /// A cache-only lookup (no decode) — cheap enough to call on the main actor.
    func cached(for data: Data, key objectID: NSManagedObjectID?, side: CGFloat) -> UIImage? {
        cache.object(forKey: key(objectID, data, side))
    }

    /// Decodes + downscales the thumbnail and stores it. Runs off the main thread
    /// (the JPEG decode and CoreGraphics draw are the expensive part). `scale` is
    /// captured on the main actor by the caller so UIScreen isn't touched here.
    func decodeAndStore(for data: Data, key objectID: NSManagedObjectID?, side: CGFloat, scale: CGFloat) -> UIImage? {
        let cacheKey = key(objectID, data, side)
        if let cached = cache.object(forKey: cacheKey) { return cached }
        guard let full = UIImage(data: data) else { return nil }
        let target = CGSize(width: side * scale, height: side * scale)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let thumb = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            let aspect = max(target.width / full.size.width, target.height / full.size.height)
            let size = CGSize(width: full.size.width * aspect, height: full.size.height * aspect)
            let origin = CGPoint(x: (target.width - size.width) / 2, y: (target.height - size.height) / 2)
            full.draw(in: CGRect(origin: origin, size: size))
        }
        cache.setObject(thumb, forKey: cacheKey)
        return thumb
    }
}
