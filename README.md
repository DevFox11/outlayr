# Outlayr

A local-first mobile expense and subscription tracker, on iPhone today and coming to Google Play. The ledger lives on the device; sync, sign-in and server features are optional. [tryoutlayr.com](https://tryoutlayr.com) · [App Store](https://apps.apple.com/app/id6801652978)

## Layout

```
apps/
  native/        Expo + React Native app, iOS and Android
  web/           tryoutlayr.com, TanStack Start
  screenshots/   App Store screenshot editor
packages/
  backend/       Convex: auth, sync, exchange rates
  money/         Money math shared by app and backend
  env/           Typed env for each app
  config/        Shared tsconfig and lint presets
video/           Remotion marketing clips
```

## Getting started

Requires Node 24 and pnpm 11. [Vite+](https://viteplus.dev) (`vp`) is the task runner, linter and formatter.

The app icons come from Hugeicons Pro, a paid private registry. Installing needs a token in your user-level config, never in the repo `.npmrc`:

```bash
pnpm config set --global "//npm.hugeicons.com/:_authToken" "<token>"
pnpm install
```

Run the app on the iOS simulator or an Android emulator:

```bash
pnpm --filter @outlayr/native ios
pnpm --filter @outlayr/native android
```

The app runs without a backend. To work on sync, sign-in or exchange rates, start a local Convex deployment and copy its URLs into `apps/native/.env` (see `apps/native/.env.example`):

```bash
pnpm run dev:setup
pnpm run dev:server
```

## Scripts

- `pnpm run check`: lint and format check (`pnpm run fix` applies fixes)
- `pnpm run check-types`: type-check every package
- `pnpm run test`: run every package's tests

Architecture notes and runbooks are in [docs](./docs/README.md).

## License

GPL-3.0, see [LICENSE](./LICENSE). `apps/native` began as a modified version of [Dime](https://github.com/rafsoh/dimeApp) by [Rafael Soh](https://github.com/rafsoh) and contributors, also GPL-3.0. Thanks for such a solid foundation.

`packages/backend` is AGPL-3.0, see [packages/backend/LICENSE](./packages/backend/LICENSE). `apps/native/modules/glow` vendors an MIT Expo module, see its [LICENSE](./apps/native/modules/glow/LICENSE).

The NumberFlow Swift package from the SwiftUI era now lives at [danestves/numberflow](https://github.com/danestves/numberflow).
