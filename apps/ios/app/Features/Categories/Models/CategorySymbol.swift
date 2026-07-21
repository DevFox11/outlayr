//
//  CategoryIcon.swift
//  Outlayr
//

import Foundation

/// What a category renders as. Storage is `icon` XOR `emoji`; this is the
/// resolved form the render path consumes.
enum CategorySymbol: Hashable {
    case icon(CategoryIcon)
    case emoji(String)
}
