# Outlayr for iOS

Outlayr is a beautifully simple, open-source expense tracker for iOS — with smart features powered by the Outlayr service.

> 📦 This directory contains the iOS app. It lives inside the [Outlayr monorepo](../../README.md), which also includes the backend (Convex) and the landing page for [tryoutlayr.com](https://tryoutlayr.com).

## Features

**Free, forever:**

- Track expenses and income with a delightfully fast input flow
- Budgets per category, with progress at a glance
- Recurring expenses with custom time frames
- Home & lock screen widgets
- iCloud sync across your devices
- Face ID / Touch ID protection, dark mode

**Outlayr AI (paid, powered by our servers):**

- Automatic expense categorization — type "pharmacy 12" and we do the rest
- Spending predictions and budget drift alerts
- Real multi-currency with live rates (USD / VES / EUR, including BCV and parallel rates)
- Subscription detection with renewal and price-hike alerts
- Monthly AI-written spending reports

The app is fully open source. Paid features rely on the Outlayr backend service — you can also [self-host it](../../docs/self-hosting.md).

## Requirements

- Xcode 16 or later
- iOS 17.0+ deployment target
- An Apple Developer account (only needed for device builds / CloudKit)

## Building

```bash
# From the monorepo root
git clone https://github.com/danestves/outlayr.git
cd outlayr/apps/ios
open Outlayr.xcodeproj
```

Let Xcode resolve the Swift Package dependencies automatically (`File > Packages > Resolve Package Versions` if needed), then build and run.

> **Note:** AI features require a running Outlayr backend. Point the app at your own instance via the build settings, or use the official service.

## Project structure

This app is part of a Turborepo monorepo. The `package.json` in this directory only wraps `xcodebuild` so CI and `turbo` can orchestrate iOS builds — all real work happens in Xcode.

## Contributing

Issues and pull requests are welcome. For anything beyond a small fix, please open an OpenSpec change proposal first (see [`openspec/`](../../openspec/) at the monorepo root) so we can align before code is written.

## Acknowledgements

Outlayr for iOS is based on [**Dime**](https://github.com/rafsoh/dimeApp) by [Rafael Soh](https://github.com/rafsoh) and contributors, released under the GPL-3.0 license. Huge thanks for building such a solid, beautiful foundation. ❤️

## License

This app is licensed under the **GNU General Public License v3.0** — see [LICENSE](./LICENSE).

Other parts of the monorepo use different licenses (the backend is AGPL-3.0, shared contracts are MIT). See the root [NOTICE.md](../../NOTICE.md) for the full license map.