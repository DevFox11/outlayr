import { renderHook } from "@testing-library/react-native";
import type { ImportStep } from "@/domain/import-flow";
import { useImportSheetOptions } from "./use-sheet-options";

describe("useImportSheetOptions", () => {
	it("keeps the same object identity across a rerender with unchanged step and height", async () => {
		const { result, rerender } = await renderHook(
			({ step, height }: { step: ImportStep; height: number }) =>
				useImportSheetOptions(step, height),
			{ initialProps: { step: "source" as ImportStep, height: 800 } },
		);
		const first = result.current;

		await rerender({ step: "source", height: 800 });

		expect(result.current).toBe(first);
	});

	it("produces a new object with a different detent array when step changes", async () => {
		const { result, rerender } = await renderHook(
			({ step, height }: { step: ImportStep; height: number }) =>
				useImportSheetOptions(step, height),
			{ initialProps: { step: "source" as ImportStep, height: 800 } },
		);
		const first = result.current;

		await rerender({ step: "review", height: 800 });

		expect(result.current).not.toBe(first);
		expect(result.current.sheetAllowedDetents).not.toStrictEqual(
			first.sheetAllowedDetents,
		);
	});
});
