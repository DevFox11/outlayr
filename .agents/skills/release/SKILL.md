---
name: release
description: Release what main has merged since the last release on a channel through this repo's EAS workflows, choosing an OTA update, a new TestFlight build, or a backend-only deploy.
argument-hint: preview|production
arguments: [channel]
disable-model-invocation: true
---

# Release main to `$channel`

Running `/release preview` or `/release production` is the go-ahead. Decide, dispatch, wait, verify, and report without asking again. The only exceptions are the stops this file names.

If the channel above isn't exactly `preview` or `production`, ask which one and stop. The build profile, update channel, and EAS environment share that name, so one word selects all three, including the Convex deployment that receives the functions.

## 1. Check out main

The fingerprint hashes the local checkout, and `workflow:run` uploads it, so it has to be a clean `origin/main`:

```sh
git status --porcelain            # must be empty; never stash other work to get there, stop and ask
git switch --detach origin/main && vp i
```

## 2. Decide

```sh
.agents/skills/release/decide.sh $channel
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
| `BUILD` | Dispatch `testflight.yml`. The printed fingerprint diff names the native source that forced it. |
| `FIRST BUILD` | **Stop and ask.** No store build exists on this channel, so this binary would move testers onto a different backend. Run `npx eas-cli env:list --environment $channel` and name the `EXPO_PUBLIC_CONVEX_URL` the binary would call. |

Before dispatching, read the commit list against the verdict. The file classification is a heuristic, but the fingerprint check is not. If a commit contradicts the verdict, for example a user-visible change that the path rules missed, stop and explain instead of dispatching.

Before an `OTA` or `BUILD`, run `node --import tsx scripts/licenses.ts --check` from `apps/native`. If it reports the open source licenses list as stale, **stop and ask**: a dependency change shipped without regenerating it, and the fix is a PR, not an edit on detached main.

## 3. Message (OTA only)

The in-app What's new sheet shows `message` verbatim, split on `\n`:

- One line per change a user would notice, written in their words: "Typing in the transaction form no longer stutters".
- No bullet marks, semicolons, or em dashes. English only.
- Leave out chores, tests, refactors, and backend-only work.

## 4. Dispatch and wait

From `apps/native`, run the command the verdict printed (with the message filled in for an OTA) in a background shell. `--wait` holds it until the run ends:

```sh
npx eas-cli workflow:run .eas/workflows/update.yml --non-interactive --wait -F channel=$channel -F message=$'First change\nSecond change'
```

Rough durations: backend about 3 minutes, OTA about 5, build plus TestFlight submit about 25. If the run fails, read `npx eas-cli workflow:logs <runId>`. Report the failing step and don't retry blindly.

## 5. Verify and report

- **OTA**: `npx eas-cli update:list --branch $channel --runtime-version <build runtime> --limit 1 --json` lists the new group. If the update landed on a runtime no build has, it reached nobody. Diff them with `npx eas-cli fingerprint:compare <build runtime> <update runtime>`.
- **Build**: `npx eas-cli build:list --platform ios --channel $channel --limit 1 --json` lists the new build. Its `runtime.version` is what OTAs target from now on.
- **Backend**: a `SUCCESS` run is the check.

Report the verdict, the commits it shipped, the run id, the update group or build number, and the runtime.

## Traps

- Never run a bare `eas update`. It leaves `EAS_BUILD_PROFILE` unset, publishes under a runtime no binary has, reports success, and reaches nobody.
- Never deploy Convex from the laptop. The workflows take the target from the EAS environment, and a local `.env.local` doesn't.
- Compare against the last build, never the last OTA. An OTA inherits its build's runtime.
- An OTA reaches only builds with the same runtime. Devices on older builds keep their JS.
- The runtime can change with no native edit: `apps/native/package.json` scripts are hashed, and adding any workspace package can re-hash pnpm peer directories. The fingerprint catches both, the file list doesn't.
- In `build:list --json`, the fields are `runtime.version` and `updateChannel.name`. There are no flat `runtimeVersion` or `channel` keys, and reading them gives `undefined`. EAS JSON can also embed raw control characters, so parse it with `json.loads(..., strict=False)`, not `jq`.
