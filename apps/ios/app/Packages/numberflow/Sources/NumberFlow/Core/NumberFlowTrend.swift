import Foundation

/// Controls which direction digits roll when the value changes.
public enum NumberFlowTrend: Equatable, Sendable {
    /// Sign of `new - old` applied to the whole number; equal values fall back
    /// to per-digit sign of diff. The web default.
    case auto
    /// Digits always roll up.
    case up
    /// Digits always roll down.
    case down
    /// Each digit rolls by the sign of its own change (web `trend: 0`).
    case perDigit
    /// Each digit takes the shorter way around the wheel (RN-port `trend: 0`).
    case shortestPath

    public func resolve(from old: Decimal, to new: Decimal) -> RollDirection {
        switch self {
        case .auto:
            if new > old { return .up }
            if new < old { return .down }
            return .signOfDiff
        case .up: return .up
        case .down: return .down
        case .perDigit: return .signOfDiff
        case .shortestPath: return .shortestPath
        }
    }
}
