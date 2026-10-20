# Identity fly-up: Apple Zoom verdict + how to improve what we have

Investigation date: 2026-07-24. Everything below was verified on device (iPhone 17 Pro,
iOS 27) against `@expo/ui` 57.0.7 / `expo-router` 57.0.8 / RN 0.86 — no claims from docs
alone. The prototype (`app/lab/zoom.tsx` → `app/lab/zoom-target.tsx`, `outlayr://lab/zoom`)
was local-only and never committed; it is not in the tree.

---

## 1. Apple Zoom — does not fit, and the reason is structural

**It works.** Both variants in the prototype animate: a plain RN source *and* — the
surprise — a source nested inside `Host` → `List` → `RNHostView`. That boundary is not the
blocker I expected it to be.

**But it zooms the whole destination page.** `Link.AppleZoom` is a *screen* transition
(UIKit fluid transitions): the destination view controller scales out of the source
rectangle. `Link.AppleZoomTarget` only decides **where the page lands**, not *what* moves.
There is no icon-only morph — the page arrives with its background, its grid, its header,
all growing together out of the tile. That is exactly the "weird, it brings the background
with it" effect.

Two further mismatches with our design:

- **Sheets are unsupported.** Documented as "only works in Stack navigator; avoid with
  sheets or popovers", and it makes sense — zoom and sheet presentation both own the
  transition. Our picker is a `formSheet` with detents `[0.5, 1]`, so adopting zoom means
  giving up the half-height sheet *and* the form staying visible/blurred behind it.
- **Different intent.** Swift's design keeps the icon as a *floating hero above* the sheet
  so you look at it while picking. Zoom's intent is "this thumbnail becomes that screen".

**Verdict: don't adopt.** It would cost the half-sheet, the blurred form behind, and Swift
parity, to remove code we can make robust far more cheaply (§3).

---

## 2. What is actually fragile in the current implementation

| # | Problem | Evidence |
|---|---|---|
| 1 | ~~`HERO_REST_TOP = 105` is a magic number calibrated by hand~~ — **fixed.** It is now `HERO_REST_TOP_FALLBACK = 88` and only used when `onGeometryChange` never fires | It encodes the List's content inset + first-section spacing, both SwiftUI's to decide. Wrong on a different nav-bar height, a large title, orientation, or if the user scrolls before tapping. |
| 2 | `measureInWindow` cannot fix #1 | Logged through the debugger: `{"heroWinY":0,"formWinY":0}` — returns **0** for RN views inside the `Host`, *and* for the form root. Anything derived from it silently collapses to 0 (this was the original "hero grows in place" bug). |
| 3 | Hero taps are flaky under automation | First synthetic tap after the screen settles is swallowed; the second works. May be simulator-only — needs a real finger to confirm. Touches cross the `RNHostView` boundary. |
| 4 | ~~The blur is an RN overlay~~ — **fixed.** The form applies the native `blur()` modifier; no `BlurView` remains | A full-screen `BlurView` whose opacity we animate, versus Swift's `.blur(radius: 8)` applied to the form itself. |
| 5 | Two heroes cross-fade | In-scroll hero fades out while the twin fades in. Swift does the same thing, so this is acceptable — noted only for completeness. |

---

## 3. The fix that matters: `onGeometryChange` replaces the magic constant

`@expo/ui` ships a SwiftUI `onGeometryChange` modifier:

```ts
onGeometryChange: (handler: (frame: { x, y, width, height }) => void) => ModifierConfig
// "x and y are in the global coordinate space (relative to the window); all values are in points."
```

**Verified working across the Host boundary** in the prototype — attached to the row's
`VStack` it reported `{x: 0, y: 361.83, width: 402, height: 154.67}`. Real global points,
from the SwiftUI side, where `measureInWindow` returns 0.

That gives us a live measurement instead of a calibrated constant:

```tsx
// hero row — reports its true position, and re-reports it as the form scrolls
<VStack modifiers={[flushInsets, ...clearRow, onGeometryChange((f) => setHeroWin(f.y))]}>

// the List reports the form's own origin, so we can convert to form-local space
<List modifiers={[listStyle("insetGrouped"), onGeometryChange((f) => setHostWin(f.y))]}>

const heroTileTop = heroWin - hostWin;   // no constant, self-correcting
```

Wins: no hand calibration, correct on any device/nav-bar/orientation, and — because SwiftUI
re-fires it on scroll — the fly-up starts from the right place **even if the user scrolls
before tapping**, which the constant cannot do.

## 4. Smaller improvements, same investigation

- **Blur the form natively.** `blur(radius: number)` exists as a modifier. Applying it to
  the `Host`/`List` matches Swift's `.blur(radius: 8)` and drops the full-screen `BlurView`
  overlay we currently fade in.
- **Swift's spring parameters are expressible directly.** `withAnimation()` takes
  `{ type: 'spring', response, dampingFraction }` — the *exact* Swift values, no
  ω-to-stiffness conversion. Useful if we ever drive the hero natively; our Reanimated
  conversion (`{stiffness: 246, damping: 27}` for `response 0.4 / dampingFraction 0.85`)
  stays correct meanwhile.
- **Tap reliability.** If the flakiness reproduces with a real finger, wrap the hero row in
  a SwiftUI `Button` (`buttonStyle("plain")`) and fire `openPicker` from the native side,
  so the tap never depends on RN hit-testing inside `RNHostView`.

---

## 5. Recommendation

Keep the current architecture — hero as a `List` row, curtain as the `Host` background,
twin overlay for the float. It matches Swift and it is working. Then:

1. ~~Replace `HERO_REST_TOP` with `onGeometryChange`~~ — **done.** `HERO_REST_TOP_FALLBACK`
   survives only as the fallback when a measurement never arrives
   (`components/transaction-form/index.tsx`).
2. ~~Swap the `BlurView` overlay for the native `blur()` modifier~~ — **done.**
3. Confirm tap reliability with a real finger; move the tap native only if it reproduces.
   *(still open)*

Do **not** adopt `Link.AppleZoom` for the identity picker. The prototype would be a good
reference for screens where a full-page zoom *is* the intent (a receipt photo opening
full-screen, for example), but it was never committed — it would have to be rebuilt.
