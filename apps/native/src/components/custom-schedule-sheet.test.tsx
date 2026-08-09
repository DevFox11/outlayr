import { act, fireEvent, render, within } from "@testing-library/react-native";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { CustomScheduleSheet } from "./custom-schedule-sheet";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));

jest.mock("number-flow-react-native", () => {
	const react = require("react") as typeof import("react");
	return {
		NumberFlow: (props: Record<string, unknown>) => react.createElement("NumberFlow", props),
	};
});

// Only the sheet is stubbed — it presents through a native host that renders to
// nothing here. Tabs is the real component, so the cadence row is under test.
jest.mock("panelui-native", () => {
	const react = require("react") as typeof import("react");
	const actual = jest.requireActual("panelui-native") as typeof import("panelui-native");
	const Content = ({ children, ...rest }: Record<string, unknown>) =>
		react.createElement("SheetContent", rest, children as never);
	const Root = ({ children, ...rest }: Record<string, unknown>) =>
		react.createElement("Sheet", rest, children as never);
	return {
		...actual,
		BottomSheet: Object.assign(Root, { Content }),
	};
});

/** 7 Aug 2026 is a Friday; monthly×3 lands on 7 Nov, 7 Feb, 7 May. */
const AUGUST = new Date(2026, 7, 7);
/** 31 Jan 2027 is the schedule February cannot hold. */
const JANUARY_31 = new Date(2027, 0, 31);

const BASE = {
	firstPayment: AUGUST,
	onDone: () => {},
	onOpenChange: () => {},
	open: true,
	recurringCoefficient: 3,
	recurringType: RECURRING_TYPE.monthly,
};

interface JsonNode {
	children: (JsonNode | string)[] | null;
	props: Record<string, unknown>;
	type: string;
}

function findByType(node: JsonNode | JsonNode[] | null, type: string): JsonNode | null {
	if (node == null) {
		return null;
	}
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findByType(child, type);
			if (found) {
				return found;
			}
		}
		return null;
	}
	if (node.type === type) {
		return node;
	}
	for (const child of node.children ?? []) {
		if (typeof child !== "string") {
			const found = findByType(child, type);
			if (found) {
				return found;
			}
		}
	}
	return null;
}

/** Drives the sentence's own stepper, which fires on press-in. */
async function step(element: Parameters<typeof fireEvent>[0], times: number) {
	for (let i = 0; i < times; i++) {
		await act(async () => {
			fireEvent(element, "pressIn");
			fireEvent(element, "pressOut");
		});
	}
}

/**
 * A press here changes state, and this renderer is concurrent — without flushing
 * inside `act` the assertion reads the frame from before the tap, and the next
 * test starts while this one's update is still pending. That surfaces as an
 * overlapping-act warning and a failure in a different test entirely.
 */
async function press(element: Parameters<typeof fireEvent.press>[0]) {
	await act(async () => {
		fireEvent.press(element);
	});
}

describe("CustomScheduleSheet", () => {
	it("bounds the stepper at both ends of what the walk can take", async () => {
		const { getByLabelText } = await render(<CustomScheduleSheet {...BASE} recurringCoefficient={1} />);
		expect(getByLabelText("transaction.schedule.fewer").props.accessibilityState.disabled).toBe(true);
		expect(getByLabelText("transaction.schedule.more").props.accessibilityState.disabled).toBe(false);
	});

	// Presets used to reset the count when the new unit had no room for it. The
	// control accepts every interval for every unit, so nothing needs resetting.
	it("keeps the interval when the unit changes", async () => {
		const onDone = jest.fn();
		const { getByRole } = await render(<CustomScheduleSheet {...BASE} onDone={onDone} />);

		await press(getByRole("tab", { name: "transaction.cadence.weeks" }));
		await press(getByRole("button", { name: "common.done" }));

		expect(onDone).toHaveBeenCalledWith(RECURRING_TYPE.weekly, 3);
	});

	it("presents the platform's own sheet", async () => {
		const { toJSON } = await render(<CustomScheduleSheet {...BASE} />);
		expect(findByType(toJSON() as JsonNode, "Sheet")?.props.native).toBe(true);
	});

	// The count is a NumberFlow rather than part of the sentence's text so it can
	// roll between values; the words either side stay plain Text.
	it("states the schedule as a sentence with the count on its own", async () => {
		const { getByTestId, toJSON } = await render(<CustomScheduleSheet {...BASE} />);
		const sentence = within(getByTestId("schedule-sentence"));
		expect(sentence.getByText("transaction.schedule.everyLabel")).toBeTruthy();
		expect(sentence.getByText("transaction.unit.months")).toBeTruthy();
		expect(findByType(toJSON() as JsonNode, "NumberFlow")?.props.value).toBe(3);
	});

	it("names the unit in the singular for an interval of one", async () => {
		const { getByTestId, toJSON } = await render(<CustomScheduleSheet {...BASE} recurringCoefficient={1} />);
		expect(within(getByTestId("schedule-sentence")).getByText("transaction.unit.month")).toBeTruthy();
		expect(findByType(toJSON() as JsonNode, "NumberFlow")?.props.value).toBe(1);
	});

	it("shows the first payment and the next three charges", async () => {
		const { getByText } = await render(<CustomScheduleSheet {...BASE} />);
		expect(getByText(/7 Aug/)).toBeTruthy();
		expect(getByText(/7 Nov/)).toBeTruthy();
		expect(getByText(/7 Feb/)).toBeTruthy();
		expect(getByText(/7 May/)).toBeTruthy();
	});

	// The whole point of the preview: what the schedule does in a short month used
	// to be invisible until the charge landed, a month later.
	it("flags the charges a short month moves, and says why", async () => {
		const { getAllByText, getByText } = await render(
			<CustomScheduleSheet {...BASE} firstPayment={JANUARY_31} recurringCoefficient={1} />
		);
		expect(getByText(/28 Feb/)).toBeTruthy();
		expect(getByText(/31 Mar/)).toBeTruthy();
		expect(getAllByText("transaction.schedule.shortMonthTag")).toHaveLength(2);
		expect(getByText("transaction.schedule.shortMonthNote")).toBeTruthy();
	});

	it("stays quiet when no month is too short to hold the schedule", async () => {
		const { queryByText } = await render(<CustomScheduleSheet {...BASE} />);
		expect(queryByText("transaction.schedule.shortMonthNote")).toBeNull();
		expect(queryByText("transaction.schedule.shortMonthTag")).toBeNull();
	});

	it("hands the edited schedule back and closes on Done", async () => {
		const onDone = jest.fn();
		const onOpenChange = jest.fn();
		const { getByLabelText, getByRole } = await render(
			<CustomScheduleSheet {...BASE} onDone={onDone} onOpenChange={onOpenChange} />
		);

		await step(getByLabelText("transaction.schedule.more"), 3);
		await press(getByRole("button", { name: "common.done" }));

		expect(onDone).toHaveBeenCalledWith(RECURRING_TYPE.monthly, 6);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("leaves the form's schedule untouched on Cancel", async () => {
		const onDone = jest.fn();
		const onOpenChange = jest.fn();
		const { getByLabelText, getByRole } = await render(
			<CustomScheduleSheet {...BASE} onDone={onDone} onOpenChange={onOpenChange} />
		);

		await step(getByLabelText("transaction.schedule.more"), 1);
		await press(getByRole("button", { name: "common.cancel" }));

		expect(onDone).not.toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	// The ripple's whole promise: a row keeps its old date until its own swap
	// lands, so no frame ever shows a date the sheet is not about to keep.
	it("holds each charge until its own beat of the ripple", async () => {
		jest.useFakeTimers();
		try {
			const { getByLabelText, getByText, queryByText } = await render(
				<CustomScheduleSheet {...BASE} recurringCoefficient={1} />
			);
			// The sheet disarms the ripple on its open edge; arm it.
			await act(async () => {
				jest.advanceTimersByTime(1);
			});

			// Monthly x1 from 7 Aug 2026.
			expect(getByText(/7 Sep/)).toBeTruthy();
			expect(getByText(/7 Nov/)).toBeTruthy();

			await step(getByLabelText("transaction.schedule.more"), 1);

			// Only row one has begun its swap, so the rows below still read the old
			// schedule and none of the new dates has appeared yet.
			expect(queryByText(/7 Nov/)).toBeTruthy();
			expect(queryByText(/7 Dec/)).toBeNull();

			await act(async () => {
				jest.advanceTimersByTime(400);
			});

			// Monthly x2: 7 Oct, 7 Dec, 7 Feb.
			expect(getByText(/7 Dec/)).toBeTruthy();
			expect(getByText(/7 Feb/)).toBeTruthy();
			expect(queryByText(/7 Sep/)).toBeNull();
		} finally {
			jest.useRealTimers();
		}
	});

	// The note is the only thing in the sheet that changes its height. Reading it
	// off the half-updated rows made it vanish and come back mid-ripple, resizing
	// the platform sheet twice in the middle of the motion.
	it("holds the short-month note steady across the whole ripple", async () => {
		jest.useFakeTimers();
		try {
			// From 31 Jul, monthly x1 clamps in September and x3 clamps in April, so
			// the note belongs on screen the whole way — but the half-swapped set in
			// between (31 Oct, 31 Jan, 31 Oct) clamps nowhere, which is what used to
			// blink it off.
			const { getByLabelText, getByText, queryByText } = await render(
				<CustomScheduleSheet {...BASE} firstPayment={new Date(2026, 6, 31)} recurringCoefficient={1} />
			);
			await act(async () => {
				jest.advanceTimersByTime(1);
			});
			expect(getByText("transaction.schedule.shortMonthNote")).toBeTruthy();

			await step(getByLabelText("transaction.schedule.more"), 2);
			for (let elapsed = 0; elapsed < 600; elapsed += 40) {
				await act(async () => {
					jest.advanceTimersByTime(40);
				});
				expect(queryByText("transaction.schedule.shortMonthNote")).toBeTruthy();
			}
		} finally {
			jest.useRealTimers();
		}
	});

	it("re-seeds from the form each time it opens", async () => {
		const { rerender, toJSON } = await render(<CustomScheduleSheet {...BASE} open={false} />);

		await act(async () => {
			rerender(<CustomScheduleSheet {...BASE} open recurringCoefficient={4} />);
		});

		expect(findByType(toJSON() as JsonNode, "NumberFlow")?.props.value).toBe(4);
	});
});
