/// How a digit wheel picks its roll direction for a single digit change.
public enum RollDirection: Equatable, Sendable {
    /// Always roll upward, wrapping through the top of the wheel when needed.
    case up
    /// Always roll downward, wrapping through zero when needed.
    case down
    /// Web `trend: 0`: each digit rolls by the sign of its own diff (8 -> 2 goes down 6).
    case signOfDiff
    /// RN-port `trend: 0`: each digit takes the shorter way around (8 -> 2 goes up 4).
    case shortestPath
}

public enum RollDelta {
    /// Signed number of wheel steps from `prev` to `value` under the given direction.
    /// Mirrors `Digit.getDelta` from barvian/number-flow, plus the RN port's
    /// shortest-path variant.
    public static func delta(from prev: Int, to value: Int, direction: RollDirection, wheel: Int = 10) -> Int {
        let diff = value - prev
        switch direction {
        case .signOfDiff:
            return diff
        case .up:
            return value < prev ? wheel - prev + value : diff
        case .down:
            return value > prev ? value - wheel - prev : diff
        case .shortestPath:
            if abs(diff) <= wheel / 2 { return diff }
            return diff > 0 ? diff - wheel : diff + wheel
        }
    }
}
