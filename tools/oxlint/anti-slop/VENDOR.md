# anti-slop (vendored)

Oxlint rules that reject low-evidence typing: casts with no stated reason,
`unknown` / `object` inputs, and values that cross a boundary unparsed.

| | |
| --- | --- |
| Upstream | https://github.com/dmmulroy/anti-slop |
| Commit | `cd064fe602b5915ff35e1e1c20836ca9bcb3729a` (2026-08-13) |
| Copied from | `src/` |
| Licence | MIT — see `LICENSE` |

Upstream ships this to be copied rather than depended on, so `src/` lives here
verbatim. It is listed in the `ignorePatterns` of both `oxlint.config.ts` and
`oxfmt.config.ts`: held at upstream's own formatting and style, a re-sync stays
a readable diff instead of a merge against our house rules.

The plugin is registered in `oxlint.config.ts` under `jsPlugins`, and every rule
carries an explicit severity there with the reason it got that one. It needs
`@oxlint/plugins` pinned to the same version as `oxlint` (currently `1.78.0`);
bump the two together.

## Editing a rule

Each rule has a `RuleTester` suite next to it. Run them with:

```sh
pnpm run test:lint-plugins
```

Node runs the `.ts` files directly, so there is no build step and no `tsx`. The
suite also runs on pre-push, because this tree sits outside every workspace and
`turbo run test` cannot see it.

## Re-syncing

```sh
git clone --depth 1 https://github.com/dmmulroy/anti-slop /tmp/anti-slop
cp -R /tmp/anti-slop/src/. tools/oxlint/anti-slop/
```

Then update the commit above, re-run the rule tests, and re-check the severities
in `oxlint.config.ts` against whatever the new rules report.
