import Foundation

/// The animation model for one rendered number: an ordered list of slots, each either a
/// digit wheel or a symbol, diffed by key across value changes.
///
/// The lifecycle is split into three phases so the view layer can drive each with its
/// own timing: `prepare` (structural, unanimated), `roll` (spin timing), `fade`
/// (opacity timing), then `prune` on completion.
public struct FlowState: Equatable, Sendable {
    public struct Slot: Equatable, Sendable, Identifiable {
        public let key: String
        public var kind: KeyedPart.Kind
        public var section: KeyedPart.Section
        /// Unbounded virtual wheel position; the displayed digit is `position mod wheel`.
        public var position: Double
        public var opacity: Double
        public var isExiting: Bool

        public var id: String { key }
    }

    public struct Diff: Equatable, Sendable {
        public var entering: Set<String> = []
        public var updating: Set<String> = []
        public var exiting: Set<String> = []
    }

    public private(set) var slots: [Slot] = []

    public init() {}

    /// A state already settled on `parts`: digits rest at their value, everything opaque.
    public init(parts: [KeyedPart]) {
        slots = parts.map { part in
            Slot(
                key: part.key,
                kind: part.kind,
                section: part.section,
                position: Double(part.digitValue ?? 0),
                opacity: 1,
                isExiting: false
            )
        }
    }

    /// Structural phase: inserts entering slots (at wheel position 0, transparent, the
    /// web's `startDigitsAtZero`), marks departed slots as exiting while keeping their
    /// visual position, and reclaims mid-exit slots in place — preserving their
    /// current position so an interrupted exit continues rather than restarting.
    ///
    /// Invariant: part keys must be unique within one decomposition.
    /// `NumberFlowFormatter.assignKeys` guarantees this via per-type counters; the
    /// dictionaries below still use a non-trapping uniquing initializer so a future
    /// violation degrades (first part wins) instead of crashing.
    public mutating func prepare(parts: [KeyedPart]) -> Diff {
        var diff = Diff()
        let newKeys = Set(parts.map(\.key))
        let liveKeys = Set(slots.filter { !$0.isExiting }.map(\.key))

        var exitingSlots: [(slot: Slot, anchor: String?)] = []
        for (index, slot) in slots.enumerated() where !newKeys.contains(slot.key) {
            var exiting = slot
            exiting.isExiting = true
            let anchor = slots[slots.index(after: index)...].first { newKeys.contains($0.key) }?.key
            exitingSlots.append((exiting, anchor))
            if !slot.isExiting { diff.exiting.insert(slot.key) }
        }

        let existing = Dictionary(slots.map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first })
        var merged: [Slot] = parts.map { part in
            if var slot = existing[part.key] {
                slot.isExiting = false
                slot.section = part.section
                if liveKeys.contains(part.key) {
                    diff.updating.insert(part.key)
                } else {
                    diff.entering.insert(part.key)
                }
                return slot
            }
            diff.entering.insert(part.key)
            let restingKind: KeyedPart.Kind
            if case .digit(_, let place) = part.kind {
                restingKind = .digit(value: 0, place: place)
            } else {
                restingKind = part.kind
            }
            return Slot(
                key: part.key,
                kind: restingKind,
                section: part.section,
                position: 0,
                opacity: 0,
                isExiting: false
            )
        }

        for (slot, anchor) in exitingSlots {
            if let anchor, let anchorIndex = merged.firstIndex(where: { $0.key == anchor }) {
                merged.insert(slot, at: anchorIndex)
            } else {
                merged.append(slot)
            }
        }

        slots = merged
        return diff
    }

    /// Spin phase: rolls updating and entering digits to their new value, rolls exiting
    /// digits to 0 as they leave, and swaps symbol texts (which crossfade, never roll).
    public mutating func roll(_ diff: Diff, parts: [KeyedPart], direction: RollDirection, wheel: Int = 10) {
        let partsByKey = Dictionary(parts.map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first })

        for index in slots.indices {
            let key = slots[index].key

            if slots[index].isExiting {
                guard diff.exiting.contains(key),
                      case .digit(let current, let place) = slots[index].kind else { continue }
                let delta = RollDelta.delta(from: current, to: 0, direction: direction, wheel: wheel)
                slots[index].position += Double(delta)
                slots[index].kind = .digit(value: 0, place: place)
                continue
            }

            guard let part = partsByKey[key] else { continue }
            switch part.kind {
            case .digit(let newValue, _):
                // The slot's own kind is the roll origin: 0 for fresh entering slots
                // (startDigitsAtZero) and the in-flight logical value for slots
                // reclaimed mid-exit, so interrupted rolls continue instead of resetting.
                let previous: Int
                if case .digit(let current, _) = slots[index].kind {
                    previous = current
                } else {
                    previous = 0
                }
                let delta = RollDelta.delta(from: previous, to: newValue, direction: direction, wheel: wheel)
                slots[index].position += Double(delta)
                slots[index].kind = part.kind
            case .symbol:
                slots[index].kind = part.kind
            }
        }
    }

    /// Opacity phase: entering slots fade in, exiting slots fade out.
    public mutating func fade(_ diff: Diff) {
        for index in slots.indices {
            let key = slots[index].key
            if diff.entering.contains(key) {
                slots[index].opacity = 1
            } else if diff.exiting.contains(key), slots[index].isExiting {
                slots[index].opacity = 0
            }
        }
    }

    /// Removes exited slots belonging to one specific update — pass the `exiting` key
    /// set of the diff whose fade just completed. Scoped so the completion of an
    /// earlier update never deletes a later update's still-fading exits, and so a
    /// slot reclaimed in the meantime (`isExiting == false` again) survives.
    public mutating func prune(_ exiting: Set<String>) {
        slots.removeAll { $0.isExiting && exiting.contains($0.key) }
    }
}
