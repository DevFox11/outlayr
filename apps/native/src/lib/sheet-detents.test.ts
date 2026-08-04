import { importStepDetents } from "./sheet-detents";

describe("importStepDetents", () => {
	it("returns ascending detents under 1 at an 874pt window", () => {
		const source = importStepDetents("source", 874);
		const file = importStepDetents("file", 874);
		const resolve = importStepDetents("resolve", 874);

		expect(source).toHaveLength(2);
		expect(file).toHaveLength(2);
		expect(resolve).toHaveLength(2);
		expect(source[1]).toBe(1);
		expect(file[1]).toBe(1);
		expect(resolve[1]).toBe(1);

		expect(source[0]).toBeCloseTo(0.431, 3);
		expect(file[0]).toBeCloseTo(0.502, 3);
		expect(resolve[0]).toBeCloseTo(0.55, 3);
		expect(source[0]).toBeLessThan(file[0] as number);
		expect(file[0]).toBeLessThan(resolve[0] as number);
		expect(resolve[0]).toBeLessThanOrEqual(1);
	});

	it("returns ascending detents under 1 at a 956pt window", () => {
		const source = importStepDetents("source", 956);
		const file = importStepDetents("file", 956);
		const resolve = importStepDetents("resolve", 956);

		expect(source[0]).toBeCloseTo(0.392, 3);
		expect(file[0]).toBeCloseTo(0.458, 3);
		expect(resolve[0]).toBeCloseTo(0.501, 3);
		expect(source[0]).toBeLessThan(file[0] as number);
		expect(file[0]).toBeLessThan(resolve[0] as number);
	});

	it("returns a single full detent for the review step", () => {
		expect(importStepDetents("review", 874)).toStrictEqual([1]);
		expect(importStepDetents("review", 956)).toStrictEqual([1]);
	});

	it("collapses to a single detent, never [1, 1], once a target exceeds the sheet's own maximum", () => {
		expect(importStepDetents("resolve", 138)).toStrictEqual([1]);
	});
});
