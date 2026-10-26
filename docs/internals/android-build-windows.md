# Android builds on Windows

The Android build does not work out of the box on Windows, and every failure is the same
260-character `MAX_PATH` limit hit at a different step. This is the setup that does work.

## What breaks

| Step | Symptom |
|---|---|
| pnpm isolated layout | `.pnpm/<pkg>@<version>_<peerhash>/node_modules/<pkg>/android` is already ~175 characters, so 255 of 265 native modules exceed the limit before CMake adds anything. |
| CMake prefab inputs | `ninja: error: ... doesn't exist` for `prefab/.../ReactAndroidConfig.cmake`, and then `manifest 'build.ninja' still dirty after 100 tries`, because Ninja 1.10 cannot stat a 287-character path. |
| App codegen objects | `ninja: error: mkdir(...)` for the mirrored absolute source path. At `C:\o` this is still 285 characters, so **no** repository path makes it fit. |

Ninja 1.13 is long-path aware; 1.10.2, the one CMake 3.22.1 ships, is not. Replacing that
binary is what unblocks the two Ninja rows above.

## Setup that works

1. SDK: `platform-tools`, `platforms;android-37.0`, `build-tools;37.0.0`, `ndk;27.1.12297006`,
   `cmake;3.22.1` (React Native 0.88 compiles against SDK 37).
2. Dependencies: `pnpm install --config.node-linker=hoisted --ignore-scripts`. The hoisted layout
   removes the `.pnpm` segment from every native module path.
3. Repository path: a real path of 4 characters or fewer (`C:\o`). Junctions and `subst` do not
   help, because Node and Gradle resolve to the real path before CMake sees it.
4. Ninja: replace `%LOCALAPPDATA%\Android\Sdk\cmake\3.22.1\bin\ninja.exe` with 1.13.1, keeping the
   original as `ninja.exe.orig`.
5. Workspace links: a hoisted install can leave `node_modules/@outlayr/{money,env,backend}` missing.
   Metro then fails with `Unable to resolve "@outlayr/money/currency"`.
6. Build, from `apps/native/android`:

```sh
gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a \
  -x :expo:generateInlineModules \
  --exclude-task ":app:createBundleReleaseJsAndAssets_PostHogUpload_com.tryoutlayr.app@1.0.0+1_1"
```

The output is `app/build/outputs/apk/release/app-release.apk`, arm64 only and signed with the
template's debug keystore, which installs on a phone but not on Play.

## The two exclusions

- `:expo:generateInlineModules` passes `["app-intents"]` to `expo-modules-autolinking` as a JSON
  argument. `cmd` strips the inner quotes, the CLI gets `[app-intents]` and `JSON.parse` throws.
  Inline modules are the iOS App Intents, so skipping the task only affects an Android build.
- `:app:createBundleReleaseJsAndAssets_PostHogUpload_<...>` uploads source maps and needs
  `POSTHOG_CLI_API_KEY` and `POSTHOG_CLI_PROJECT_ID`, or a logged-in `~/.posthog/credentials.json`.

## Prefer Linux

CI builds the store artifacts on `ubuntu-26.04`, where none of this exists. This document is for a
local APK on a Windows workstation, not for the release pipeline.
