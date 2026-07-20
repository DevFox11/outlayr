# NumberFlow

A rolling numeric display for SwiftUI. Digits spin on cylindrical wheels, symbols
crossfade, and digit-count changes (`999 -> 1000`) enter and exit gracefully.

Motion spec derived from [barvian/number-flow](https://github.com/barvian/number-flow) (MIT).

## Usage

```swift
import NumberFlow

NumberFlow(balance, currency: "USD")

NumberFlow(count)

NumberFlow(ratio, format: .percent)
    .numberFlowTrend(.perDigit)
    .numberFlowTransition(.init(spin: .snappy))
```

Values are formatted with Foundation `FormatStyle`, so grouping, separators, and
currency placement are locale-correct for free. Configuration flows through the
environment: `numberFlowTransition(_:)` sets the transform/spin/opacity timings,
`numberFlowTrend(_:)` picks the roll direction policy (`.auto`, `.up`, `.down`,
`.perDigit`, `.shortestPath`).

## Details

- Default motion: critically-damped spring (`Spring(duration: 0.61, bounce: 0)`)
  for transforms and spins, 450 ms ease-out for fades — fitted against the
  original's published easing curve.
- Digit wheels are driven through a `GeometryEffect`, so per-frame animation
  updates only transforms, never view bodies.
- Respects Reduce Motion (values crossfade instead of rolling) and exposes one
  accessibility element with the fully formatted number.
- Zero dependencies. iOS 17+, macOS 14+.

## Limitations

- Non-Latin numbering systems (Arabic-Indic, Devanagari, ...) do not get rolling
  wheels: the digit glyphs are Latin, so those strings gracefully degrade to a
  whole-string crossfade.
- Scientific and compact notation suffixes (`E4`, `K`, `M`) are unattributed
  literals in Foundation's output; they render as static symbols and swap as
  text rather than rolling.

## License

MIT — see [LICENSE](LICENSE).
