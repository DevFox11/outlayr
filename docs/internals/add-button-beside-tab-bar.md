# Add button beside the tab bar: parked

**Status:** parked on 2026-09-30. The floating add button on the Log stays as it is.
**Worth reopening when:** the navigation library can draw a separate trailing item, or a
design that gives the four secondary actions a home is picked.

## What was wanted

Option A of "Reaching the form" in the entry editor chrome mocks: a plus that docks at the end of the tab bar, in
the tab bar's own band. Tap opens a new transaction. Hold opens the other four actions
(speak an entry, scan a receipt, move money, import a CSV).

Two problems with today's button motivated it:

- A new transaction is two taps: the button, then the first item of its menu.
- The button floats over the Log and covers the amount column of the rows behind it.

## What the platform allows

Tried on the simulator (iOS 27) with expo-router 57.0.23 `NativeTabs` and
react-native-screens 4.26.2.

| Wanted | Result |
|---|---|
| A separate round button beside the tab bar | Not available |
| A plus as an item inside the tab bar | Works |
| Tap opens the form without changing tab | Works |
| Hold opens the other four actions | Not available |

**Separate button.** iOS draws a detached trailing item for a search tab. `NativeTabs` exposes
that as `role="search"`, but react-native-screens builds the item with
`UITabBarItem(tabBarSystemItem:)` (`RNSTabsScreenComponentView.mm`, `createTabBarItem`), not
with the `UISearchTab` the detached look belongs to. The item stays inside the pill. This was
checked three ways: with a custom icon and label, with a custom icon only, and with the bare
system item and no title override, the last one after a cold start.

**Tap as an action.** A trigger that is `disabled` still emits `tabPress`, so it can open a
route while the selected tab stays put:

```tsx
<NativeTabs.Trigger
    disabled
    listeners={{ tabPress: () => router.push("/transactions/create") }}
    name="add"
>
    <NativeTabs.Trigger.Icon sf="plus" />
    <NativeTabs.Trigger.Label>{t("log.add.menu")}</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
```

It needs a route to hang on, `src/app/(tabs)/add.tsx`, whose screen renders nothing.

**Hold.** A native tab item has no long-press hook. A React Native view cannot sit over the
tab bar to catch one either: the tab bar is drawn above each tab's content.

## Why it was parked

The version that can be built is a fifth item inside the tab bar, not a button beside it, and
it leaves the four secondary actions without a home. The options considered for them:

1. A native menu in the Log's top bar, next to the calendar and filter buttons.
2. A row of buttons at the top of a new transaction.
3. Keep the floating button.

The owner chose 3.

## What to check when reopening

- Whether react-native-screens or expo-router has gained a detached trailing item
  (`UISearchTab`, or any trailing accessory that accepts a press handler).
- `NativeTabs.BottomAccessory`, which places a view above the tab bar. It was not tried. It
  would not sit beside the tab bar, but it may be a home for the secondary actions.
- Whether the icon can come from the app's own icon set. The prototype used an SF Symbol; the
  other tabs use PNG assets.
- The button covering the amount column is still true and is independent of this decision.
