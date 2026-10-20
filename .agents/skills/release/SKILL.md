---
name: release
description: Release what main has merged since the last release on a channel, choosing an OTA update (EAS workflow), a new store build (rnd on GitHub Actions, then TestFlight or Google Play), or a backend-only deploy.
argument-hint: preview|production [ios|android]
arguments: [channel, platform]
disable-model-invocation: true
---

# Release main to `$channel`

Running `/release preview` or `/release production`, with `android` after it for Android, is the go-ahead. Decide, dispatch, wait, verify, and report without asking again. The only exceptions are the stops this file names.

If the channel above isn't exactly `preview` or `production`, ask which one and stop. The build profile, update channel, and EAS environment share that name, so one word selects all three, including the Convex deployment that receives the functions.

The platform is `$platform`. Empty means `ios`. If it's neither `ios` nor `android`, ask which one and stop. The runtime fingerprint is per platform, so each platform gets its own verdict; to ship both, run the skill once per platform.

## 1. Check out main

The fingerprint hashes the local checkout, `workflow:run` uploads it, and `rnd build` builds `main` on GitHub, so it has to be a clean `origin/main`:

```sh
git status --porcelain            # must be empty; never stash other work to get there, stop and ask
git switch --detach origin/main && vp i
```

## 2. Decide

```sh
.agents/skills/release/decide.sh $channel $platform
```

The script is read-only. It prints:

- the newest finished store build on the channel
- the last OTA on that build's runtime
- every commit merged since the later of the two
- the app and backend files those commits touched
- the fingerprint check against the build
- a verdict, with the exact command to run

| Verdict | Action |
| --- | --- |
| `NOTHING TO SHIP` | Report and stop. If the fingerprint differs, say that the next app change will need a build. |
| `BACKEND ONLY` | Dispatch `deploy-backend.yml`. The app bundle doesn't import `packages/backend`, so there's nothing to publish. |
| `OTA` | Write the message (step 3), then dispatch `update.yml`. |
| `BUILD` | Run the `rnd build` it prints, then ship the binary (step 4). The printed fingerprint diff names the native source that forced it. |
| `FIRST BUILD` | **Stop and ask.** No GitHub store build exists on this channel, so this binary would move testers onto a different backend, and every earlier EAS build stops receiving OTAs from this one on. Run `npx eas-cli env:list --environment $channel` and name the `EXPO_PUBLIC_CONVEX_URL` the binary would call. Check the setup below. |

Before dispatching, read the commit list against the verdict. The file classification is a heuristic, but the fingerprint check is not. On Android it relies on a patched `@expo/fingerprint` that sees the Expo modules; `decide.sh` exits if the fingerprint lists none, and that is a stop to report, never one to work around. If a commit contradicts the verdict, for example a user-visible change that the path rules missed, stop and explain instead of dispatching.

Before an `OTA` or `BUILD`, run `node --import tsx scripts/licenses.ts --check` from `apps/native`. If it reports the open source licenses list as stale, **stop and ask**: a dependency change shipped without regenerating it, and the fix is a PR, not an edit on detached main.

## 3. Message (OTA only)

The in-app What's new sheet shows `message` verbatim, split on `\n`:

- One line per change a user would notice, written in their words: "Typing in the transaction form no longer stutters".
- No bullet marks, semicolons, or em dashes. English only.
- Leave out chores, tests, refactors, backend-only work, and changes only the other platform shows.

## 4. Dispatch and wait

From `apps/native`, run the command the verdict printed (with the message filled in for an OTA) in a background shell. `--wait` holds an EAS run until it ends:

```sh
npx eas-cli workflow:run .eas/workflows/update.yml --non-interactive --wait -F channel=$channel -F platform=ios -F message=$'First change\nSecond change'
```

A `BUILD` dispatches `.github/workflows/eas-build.yml`, which deploys Convex and then builds. `rnd build` waits for the run and prints the build, whose `id` the next steps take. Then ship it:

```sh
rnd() { npx -y -p @react-native-feel/deploy@0.3.0 rnd "$@"; }
rnd build:download --build-id <id> -p $platform   # into ./build, as a zip
(cd build && unzip -o '*.zip')
# iOS only: upload to App Store Connect and add it to TestFlight's Internal group.
# The submit profile carries only App Store Connect details, so it serves both channels.
rnd submit -p ios --profile production --path build/<name>.ipa --groups Internal
```

Android stops at the `.aab`: rnd can't submit to Play. Report its path; Daniel uploads it to the internal track in Play Console.

Rough durations: backend about 3 minutes, OTA about 5. GitHub builds have no timing yet. If an EAS run fails, read `npx eas-cli workflow:logs <runId>`; if a build fails, `gh run view <runId> --log-failed`, and on iOS the `xcode-logs` artifact. Report the failing step and don't retry blindly.

## 5. Verify and report

- **OTA**: `npx eas-cli update:list --branch $channel --runtime-version <build runtime> --limit 1 --json` lists the new group. If the update landed on a runtime no build has, it reached nobody. Diff them with `npx eas-cli fingerprint:compare <build runtime> <update runtime>`.
- **Build**: the run's `fingerprint` artifact holds the runtime OTAs target from now on; `decide.sh` reads it. On iOS, `rnd submit:status -p ios` lists the new TestFlight build.
- **Backend**: a `SUCCESS` run is the check.

Report the verdict, the commits it shipped, the run id, the update group or build number, and the runtime.

## Build setup

Before a `FIRST BUILD`, confirm each of these exists and name any that don't:

- rnd is logged in on this machine: `EAS_GITHUB_TOKEN=$(gh auth token) rnd login`, then `rnd whoami`.
- The repository secrets listed at the top of `.github/workflows/eas-build.yml`: `gh secret list`. The signing ones come from EAS once, with `npx eas-cli credentials` (Daniel runs it; it is interactive).
- `asc auth status` shows an App Store Connect key, for iOS submits.
- `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` in `env:list`, for Android. The workflow checks it before it deploys.

## Traps

- Never run a bare `eas update`. It leaves `EAS_BUILD_PROFILE` unset, publishes under a runtime no binary has, reports success, and reaches nobody.
- Never deploy Convex from the laptop. The workflows take the target from the EAS environment, and a local `.env.local` doesn't.
- Compare against the last build, never the last OTA. An OTA inherits its build's runtime.
- An OTA reaches only builds with the same runtime. Devices on older builds keep their JS.
- The file lists skip what only the other platform builds from: `.android.` siblings on iOS, `app-intents/` and `targets/` on Android. The fingerprint doesn't, so an App Intents change can make Android's fingerprint differ with nothing to ship.
- The runtime can change with no native edit: `apps/native/package.json` scripts are hashed, and adding any workspace package can re-hash pnpm peer directories. The fingerprint catches both, the file list doesn't.
- EAS JSON can embed raw control characters, so parse it with `json.loads(..., strict=False)`, not `jq`.
