# outlayr

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Convex, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Convex** - Reactive backend-as-a-service platform
- **Biome** - Linting and formatting
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Convex Setup

This project uses Convex as a backend. You'll need to set up Convex before running the app:

```bash
pnpm run dev:setup
```

Follow the prompts to create a new Convex project and connect it to your application.

Copy environment variables from `packages/backend/.env.local` to `apps/*/.env`.

Then, run the development server:

```bash
pnpm run dev
```

Your app will connect to the Convex cloud backend automatically.

## Git Hooks and Formatting

- Run checks: `pnpm run check`

## Project Structure

```
outlayr/
├── apps/
├── packages/
│   ├── backend/     # Convex backend functions and schema
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:setup`: Setup and configure your Convex project
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run check`: Run Biome formatting and linting

## License

This repository is licensed under the **GNU General Public License v3.0** by default — see [LICENSE](./LICENSE). `apps/native` is a modified version of [Dime](https://github.com/rafsoh/dimeApp) by [Rafael Soh](https://github.com/rafsoh) and contributors, released under the GPL-3.0 license. Huge thanks for building such a solid, beautiful foundation. ❤️

`packages/backend` overrides the default and is licensed under the **GNU Affero General Public License v3.0** — see [packages/backend/LICENSE](./packages/backend/LICENSE).

`apps/native/modules/glow` vendors an Expo module released under the MIT License — see [apps/native/modules/glow/LICENSE](./apps/native/modules/glow/LICENSE).

The NumberFlow Swift package formerly at `apps/ios/app/Packages/numberflow` now lives at [danestves/numberflow](https://github.com/danestves/numberflow).
