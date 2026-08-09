import { fireEvent, render, userEvent } from "@testing-library/react-native";
import { FadeInLeft, FadeInRight, Keyframe, ReduceMotion } from "react-native-reanimated";
import { HEADER_BUTTON_ENTERING, SheetHeader, titleEntering } from "./sheet-header";

jest.mock("@/i18n/context", () => ({
	useTranslation: () => (key: string) => key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({ foreground: "#17150F", muted: "#8A8578" }),
}));

describe("SheetHeader", () => {
	it("renders the step title", async () => {
		const { getByText } = await render(<SheetHeader onClose={jest.fn()} title="Review" />);
		expect(getByText("Review")).toBeTruthy();
	});

	it("hides the back chevron when no onBack is given", async () => {
		const { queryByTestId } = await render(<SheetHeader onClose={jest.fn()} title="Import" />);
		expect(queryByTestId("import-sheet-back")).toBeNull();
	});

	it("steps back through onBack", async () => {
		const onBack = jest.fn();
		const { getByTestId } = await render(<SheetHeader onBack={onBack} onClose={jest.fn()} title="Choose a file" />);
		fireEvent.press(getByTestId("import-sheet-back"));
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it("dismisses through onClose", async () => {
		const onClose = jest.fn();
		const { getByTestId } = await render(<SheetHeader onClose={onClose} title="Import" />);
		fireEvent.press(getByTestId("import-sheet-close"));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("centers the title in a full-width overlay that never eats taps", async () => {
		const { getByTestId } = await render(<SheetHeader onBack={jest.fn()} onClose={jest.fn()} title="Review" />);
		expect(getByTestId("import-sheet-title").props.pointerEvents).toBe("none");
	});

	it("keeps both buttons pressable when the centered title overlays them", async () => {
		const onBack = jest.fn();
		const onClose = jest.fn();
		const { getByTestId } = await render(<SheetHeader onBack={onBack} onClose={onClose} title="Choose a file" />);
		const user = userEvent.setup();
		await user.press(getByTestId("import-sheet-back"));
		await user.press(getByTestId("import-sheet-close"));
		expect(onBack).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("keeps the close button pinned right when the back button is absent", async () => {
		const { getByTestId } = await render(<SheetHeader onClose={jest.fn()} title="Import" />);
		expect(getByTestId("import-sheet-close-slot").props.className).toContain("ml-auto");
	});

	it("keeps the close button pinned right alongside the back button", async () => {
		const { getByTestId } = await render(<SheetHeader onBack={jest.fn()} onClose={jest.fn()} title="Review" />);
		expect(getByTestId("import-sheet-close-slot").props.className).toContain("ml-auto");
	});

	it("slides the title in from the right when navigating forward", () => {
		const entering = titleEntering(true);
		expect(entering).toBeInstanceOf(FadeInRight);
		expect(entering.durationV).toBe(200);
		expect(entering.reduceMotionV).toBe(ReduceMotion.System);
	});

	it("slides the title in from the left when navigating back", () => {
		const entering = titleEntering(false);
		expect(entering).toBeInstanceOf(FadeInLeft);
		expect(entering.durationV).toBe(200);
		expect(entering.reduceMotionV).toBe(ReduceMotion.System);
	});

	it("zooms the header buttons in with a reduced-motion-aware keyframe", () => {
		expect(HEADER_BUTTON_ENTERING).toBeInstanceOf(Keyframe);
		const { reduceMotionV } = HEADER_BUTTON_ENTERING as unknown as {
			reduceMotionV: ReduceMotion;
		};
		expect(reduceMotionV).toBe(ReduceMotion.System);
	});

	it("remounts the animated title when the step title changes", async () => {
		const { getByTestId, rerender } = await render(<SheetHeader onClose={jest.fn()} title="Import" />);
		const first = getByTestId("import-sheet-title-motion", {
			includeHiddenElements: true,
		});
		await rerender(<SheetHeader onClose={jest.fn()} title="Review" />);
		const second = getByTestId("import-sheet-title-motion", {
			includeHiddenElements: true,
		});
		expect(second).not.toBe(first);
	});

	it("remounts the close button on step change so its entrance replays", async () => {
		const { getByTestId, rerender } = await render(<SheetHeader onClose={jest.fn()} title="Import" />);
		const first = getByTestId("import-sheet-close-slot", {
			includeHiddenElements: true,
		});
		await rerender(<SheetHeader onClose={jest.fn()} title="Review" />);
		const second = getByTestId("import-sheet-close-slot", {
			includeHiddenElements: true,
		});
		expect(second).not.toBe(first);
	});
});
