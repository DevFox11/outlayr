import {
	clampIndex,
	directionFor,
	nextIndex,
	prevIndex,
	resolveStepIndex,
} from "./cursor";

describe("nextIndex", () => {
	it("is a no-op past the last step", () => {
		expect(nextIndex(2, 3, true)).toBe(2);
	});

	it("is a no-op when canLeave is false", () => {
		expect(nextIndex(0, 3, false)).toBe(0);
	});

	it("advances by one when leaving is allowed and steps remain", () => {
		expect(nextIndex(0, 3, true)).toBe(1);
	});
});

describe("prevIndex", () => {
	// The composed `useWizard().back()` must also not call `onExit` at index 0
	// (design §3.4) — that is proven at the integration level in
	// `wizard.test.tsx`, since `onExit` is a side effect and this module is
	// deliberately pure with no callback of its own to spy on.
	it("is a no-op at index 0", () => {
		expect(prevIndex(0)).toBe(0);
	});

	it("retreats by one otherwise", () => {
		expect(prevIndex(2)).toBe(1);
	});
});

describe("clampIndex", () => {
	it("clamps into [0, count-1]", () => {
		expect(clampIndex(-1, 3)).toBe(0);
		expect(clampIndex(5, 3)).toBe(2);
		expect(clampIndex(1, 3)).toBe(1);
	});
});

describe("resolveStepIndex", () => {
	const steps = ["source", "file", "resolve"] as const;

	it("returns the matching index for a known step", () => {
		expect(resolveStepIndex(steps, "file")).toBe(1);
	});

	it("throws in __DEV__ for a step outside the declared set", () => {
		expect(() => resolveStepIndex(steps, "review" as never)).toThrow();
	});

	it("is a no-op (returns null) for an unknown step outside __DEV__", () => {
		const devFlag = globalThis as typeof globalThis & { __DEV__: boolean };
		const original = devFlag.__DEV__;
		devFlag.__DEV__ = false;
		try {
			expect(resolveStepIndex(steps, "review" as never)).toBeNull();
		} finally {
			devFlag.__DEV__ = original;
		}
	});
});

describe("directionFor", () => {
	it("is 1 moving forward and -1 moving back", () => {
		expect(directionFor(0, 1)).toBe(1);
		expect(directionFor(1, 0)).toBe(-1);
	});

	it("treats a same-index move as forward", () => {
		expect(directionFor(1, 1)).toBe(1);
	});
});
