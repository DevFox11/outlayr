// `addDatabaseChangeListener` is a native subscription with no jest-expo mock, so
// any suite that renders a component reading through `useLiveQuery` had to stub
// it — twelve did, identically. The default here is inert: it hands back a
// subscription that never fires, which is what a component test wants.
//
// A suite that needs the listener to actually deliver — `live-query` and the
// contexts that assert re-render on write — declares its own `jest.mock` for
// `expo-sqlite`, which takes precedence over this one.
jest.mock("expo-sqlite", () => ({
    ...jest.requireActual("expo-sqlite"),
    addDatabaseChangeListener: () => ({ remove: () => {} }),
}));
