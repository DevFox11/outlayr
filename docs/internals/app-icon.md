# The `.icon` bundles are pinned to the Xcode 26 schema

Every `apps/native/assets/*.icon` bundle was authored in Icon Composer 2.0, which ships with
Xcode 27. EAS Build had no Xcode 27 image then, so three Icon Composer 2.0 constructs were removed
to let the cloud archive succeed. This file records exactly what came out and how to put it back.

## Why

EAS Build's newest macOS image was `macos-tahoe-26.5-xcode-26.6`, so **Xcode 26.6**. Local
development runs Xcode 27 beta (`27A5228h`) with Icon Composer 2.0, which is why `expo run:ios`
never saw a problem while every cloud archive died in `CompileAssetCatalogVariant thinned`:

```
Could not open "OutlayrTesting.icon".
/* com.apple.actool.errors */
error: Exception while running actool: *** -[__NSPlaceholderArray initWithObjects:count:]: …
```

An earlier attempt that de-registered all four alternates and compiled `Outlayr.icon` alone failed
the same way, with the underlying decode error spelled out:

```
The data couldn't be read because it isn't in the correct format.
```

That is a `Codable` decode failure, not a missing file, and it points at value *types* rather than
unknown keys: an unknown key is ignored by a Swift decoder, a `String` where a `Bool` is expected
is not.

## What was removed

Applied to all six bundles: `Outlayr`, `OutlayrTesting`, `OutlayrInk`, `OutlayrHairline`,
`OutlayrMono`, `OutlayrEmboss`.

| Construct | Was | Now | Where |
| --- | --- | --- | --- |
| Feature opt-in | `"features": ["refractivity", "specular-location"]` | removed | top level, all six |
| Specular placement | `"specular": "inside"` | `"specular": true` | each group, all six |
| Refractivity | `"refractivity": { "depth": 0, "enabled": true, "strength": 0.5 }` | removed | `Outlayr.icon` only |

`fill-specializations`, `blur-material`, `translucency`, `lighting`, `shadow`, `position` and
`supported-platforms` all stayed. They are not Icon Composer 2.0 additions and Xcode 26 reads them.

## What it costs

Measured with `ictool`, which renders either design generation from the same document. Every icon
was rendered at 512×512, Default and Dark, before and after the edit, and compared with
`magick compare -metric RMSE`:

| Design generation | Result |
| --- | --- |
| 26 (what iOS 26 devices draw today) | Five of six bundles byte-identical. `Outlayr.icon` differs by roughly one pixel in 262,144 (RMSE 0.0001). |
| 27 | All six change, RMSE 0.010 to 0.019. |

So nothing visible is lost on the OS this ships to. What is deferred is the generation 27 look:
refractivity depth on the production mark, and specular highlight placement on all six.

The flat Xcode 26 spellings `refractivity-strength` and `refractivity-depth` were tried as a way to
keep the effect. Icon Composer 2.0 ignores them on input: a probe bundle carrying them rendered
identically to the stripped one, not to the original. There is no way to keep refractivity in a
file Xcode 26 can parse.

## How to put it back

Store builds now run on GitHub's `xcode-27` runner, whose default is Xcode 27.0. So this can be
done; check the `runs-on` label in `.github/workflows/eas-build.yml` against
[GitHub's runner images](https://github.com/actions/runner-images) first, in case it moved back.

Add to the top level of all six `icon.json` files:

```json
"features": ["refractivity", "specular-location"],
```

Change `"specular": true` back to `"specular": "inside"` in every group of all six, and restore the
refractivity block to the single group in `Outlayr.icon`:

```json
"refractivity": {
  "depth": 0,
  "enabled": true,
  "strength": 0.5
},
```

## Do not re-save these in Icon Composer

Opening a bundle in Icon Composer 2.0 and saving rewrites it in the 2.0 schema, which puts the
build back where it started. Edit the JSON by hand, or re-check this file after any Icon Composer
round trip.

## Verifying a change locally

`ictool` lives inside Icon Composer and renders without a build:

```sh
IC="$(xcode-select -p)/../Applications/Icon Composer.app/Contents/Executables/ictool"
"$IC" apps/native/assets/Outlayr.icon --export-image --output-file /tmp/icon.png \
  --platform iOS --rendition Default --width 512 --height 512 --scale 1 --design-generation 26
```

That proves the artwork, not the compatibility. Only an EAS build proves the pinned image's Xcode
can compile the bundle, because local development runs a different Xcode.
