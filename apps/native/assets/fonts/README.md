# App fonts — SF Pro Rounded (required for typography parity)

The RN layer renders body/label/number text in **SF Pro Rounded** to match the
SwiftUI app's `.system(design: .rounded)`. Those OTFs are Apple-licensed and are
**not committed to the repo**, so they must be dropped in here by hand.

## Drop these four files into `apps/native/assets/fonts/`

| File name                       | Resolves to `fontFamily` |
| ------------------------------- | ------------------------ |
| `SF-Pro-Rounded-Regular.otf`    | `SFProRounded-Regular`   |
| `SF-Pro-Rounded-Medium.otf`     | `SFProRounded-Medium`    |
| `SF-Pro-Rounded-Semibold.otf`   | `SFProRounded-Semibold`  |
| `SF-Pro-Rounded-Bold.otf`       | `SFProRounded-Bold`      |

The `fontFamily` values above are the OTFs' **PostScript names** (iOS resolves
bundled fonts by PostScript name). `src/components/text.tsx` maps a `Text`'s
`fontWeight` to the matching family, and `global.css` exposes them as the
`--font-sans*` theme tokens.

## Where to get them

Download the **SF Pro** font package from Apple:
<https://developer.apple.com/fonts/> → install the dmg → the rounded OTFs live in
`/Library/Fonts/` (e.g. `SF-Pro-Rounded-Regular.otf`). Copy the four weights
listed above into this folder using these exact file names.

Any other rounded OTF set works too — just rename the files to match the table
and update the PostScript names in `src/components/text.tsx` if they differ.

## How the wiring behaves

`app.config.ts` bundles these via the `expo-font` config plugin, but only the
files that actually exist — a missing file is skipped so `expo prebuild` never
fails. Until all four are present the app falls back to the system font (San
Francisco, not rounded); it does **not** crash.

## Taking effect

Bundling fonts is a **native** change: run `expo prebuild` + a native rebuild
after adding the files. Metro hot-reload alone will not pick them up.
