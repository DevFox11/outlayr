import ExpoModulesCore
import ExpoUI
import SwiftUI

/// `.scrollContentBackground(_:)` and `.listRowBackground(_:)`, neither of which
/// `@expo/ui` 57.0.9 ships. Without the first, a SwiftUI `List` paints
/// `systemGroupedBackground` below the level any of our tokens reach; without the
/// second its rows keep `secondarySystemGroupedBackground`.
///
/// `ViewModifierRegistry` is ExpoUI's public extension point for exactly this, so
/// nothing here forks the package. The JS side is `src/components/native/modifiers.ts`.
enum ListGroundModifiers {
  static let scrollContentBackground = "scrollContentBackground"
  static let listRowBackground = "listRowBackground"

  /// Registering after ExpoUI's own built-ins would log an overwrite warning, so
  /// this is a no-op the day either name ships upstream.
  static func register() {
    ViewModifierRegistry.register(scrollContentBackground) { params, appContext, _ in
      return try ScrollContentBackgroundModifier(from: params, appContext: appContext)
    }
    ViewModifierRegistry.register(listRowBackground) { params, appContext, _ in
      return try ListRowBackgroundModifier(from: params, appContext: appContext)
    }
  }

  static func unregister() {
    ViewModifierRegistry.unregister(scrollContentBackground)
    ViewModifierRegistry.unregister(listRowBackground)
  }
}

/// ExpoUI has a `VisibilityOptions` of its own, but it is `internal` to that module.
private enum GroundVisibility: String, Enumerable {
  case automatic
  case hidden
  case visible

  func toVisibility() -> Visibility {
    switch self {
    case .automatic:
      return .automatic
    case .hidden:
      return .hidden
    case .visible:
      return .visible
    }
  }
}

private struct ScrollContentBackgroundModifier: ViewModifier, Record {
  @Field var visibility: GroundVisibility = .automatic

  func body(content: Content) -> some View {
    content.scrollContentBackground(visibility.toVisibility())
  }
}

private struct ListRowBackgroundModifier: ViewModifier, Record {
  @Field var color: Color?

  @ViewBuilder
  func body(content: Content) -> some View {
    if let color {
      content.listRowBackground(color)
    } else {
      content
    }
  }
}
