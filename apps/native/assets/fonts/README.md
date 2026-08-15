# App fonts — SF Pro Rounded (required for typography parity)

The RN layer renders body/label/number text in **SF Pro Rounded** to match the
SwiftUI app's `.system(design: .rounded)`. These OTFs are Apple-licensed but
**are committed** to this (private) repo: EAS Build archives only git-tracked
files, and a gitignored font is skipped silently rather than failing the build,
so every cloud build shipped in the system face instead. Committing them is what
keeps release builds honest.

## The four files

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

## Where they came from

The **SF Pro** font package from Apple: <https://developer.apple.com/fonts/> →
install the dmg → the rounded OTFs live in `/Library/Fonts/`. Replacing or
re-adding a weight means copying it here under the exact file name above.

Any other rounded OTF set works too — just rename the files to match the table
and update the PostScript names in `src/components/text.tsx` if they differ.

## How the wiring behaves

`app.config.ts` bundles these via the `expo-font` config plugin and lists all
four unconditionally, so a missing file fails the build. It used to filter the
list by `existsSync` and skip whatever was absent, which was worse than it
sounds: on EAS that check resolved against the temp directory Expo transpiles
the config into, silently dropped every weight, and produced a release in the
system face with no error anywhere in the logs.

## Taking effect

Bundling fonts is a **native** change: run `expo prebuild` + a native rebuild
after adding the files. Metro hot-reload alone will not pick them up.
