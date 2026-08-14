import type { LocalDataContextValue } from "@/contexts/local-data-context";

/**
 * A complete {@link LocalDataContextValue} for a `useLocalData` mock, with
 * `overrides` applied over a ready, error-free context.
 *
 * Test-only. `LocalDataProvider` runs the open → migrate → seed sequence against
 * a real SQLite file, which jest has none of, so suites that render below the
 * splash gate mock the hook instead. Returning only the member under test makes
 * the mock's return type incomplete; pass that member as an override here.
 */
export const testLocalData = (overrides: Partial<LocalDataContextValue> = {}): LocalDataContextValue => ({
    db: null,
    error: null,
    retry: () => {
        // a test that asserts on retry passes its own spy
    },
    status: "ready",
    ...overrides,
});
