import { fireEvent, render } from "@testing-library/react-native";
import type { ImportReviewResult } from "@/hooks/use-import-review";
import { DoneStep } from "./done-step";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string, params?: Record<string, unknown>) =>
		params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		foreground: "#17150F",
		muted: "#8A8578",
		income: "#2E7D32",
	}),
}));
jest.mock("@/contexts/display-settings-context", () => ({
	useDisplaySettings: () => ({
		state: { showCents: true },
	}),
}));

const ENTRY = {
	note: "Bakery",
	categoryId: "cat-food",
	income: false,
	amount: 12.5,
	currency: null,
	date: new Date(2026, 6, 28),
};

function doneReview(
	overrides: Partial<ImportReviewResult> = {},
): ImportReviewResult {
	return {
		plan: {
			entries: [ENTRY],
			skipped: [],
			earliest: new Date(2026, 6, 1),
			latest: new Date(2026, 6, 28),
		},
		rows: [
			{
				kind: "entry",
				key: "entry-0",
				index: 0,
				entry: ENTRY,
				duplicate: false,
			},
			{
				kind: "entry",
				key: "entry-1",
				index: 1,
				entry: ENTRY,
				duplicate: true,
			},
		],
		excluded: new Set([1]),
		selectedCount: 1,
		categoryName: new Map(),
		categoryTile: new Map(),
		currency: "USD",
		commit: {
			phase: "success",
			count: 12,
			outAmount: 348.4,
			duplicatesSkipped: 0,
		},
		onToggle: jest.fn(),
		onCommit: jest.fn(),
		...overrides,
	} as ImportReviewResult;
}

interface JsonNode {
	props?: Record<string, unknown>;
	children?: (JsonNode | string)[] | null;
}

function classNames(node: JsonNode | JsonNode[] | null): string[] {
	if (node == null) {
		return [];
	}
	if (Array.isArray(node)) {
		return node.flatMap(classNames);
	}
	const own = node.props?.className;
	return [
		...(typeof own === "string" ? [own] : []),
		...(node.children ?? []).flatMap((child) =>
			typeof child === "string" ? [] : classNames(child),
		),
	];
}

describe("DoneStep", () => {
	it("renders the ink stamp with the committed count", async () => {
		const { getByTestId, getByText } = await render(
			<DoneStep onDone={jest.fn()} review={doneReview()} />,
		);
		expect(getByTestId("import-done-stamp")).toBeTruthy();
		expect(getByText('import.doneStamp:{"count":12}')).toBeTruthy();
	});

	it("rotates the stamp slightly with an income-coloured border", async () => {
		const { getByTestId } = await render(
			<DoneStep onDone={jest.fn()} review={doneReview()} />,
		);
		const style = getByTestId("import-done-stamp").props.style;
		const flat = Array.isArray(style)
			? Object.assign({}, ...style.filter(Boolean))
			: style;
		expect(flat.borderWidth).toBe(1.5);
		expect(flat.transform).toStrictEqual([{ rotate: "-2deg" }]);
	});

	it("names the skipped duplicates and the month now on the Log", async () => {
		const month = new Date(2026, 6, 28).toLocaleDateString(undefined, {
			month: "long",
		});
		const { getByText } = await render(
			<DoneStep
				onDone={jest.fn()}
				review={doneReview({
					commit: {
						phase: "success",
						count: 12,
						outAmount: 348.4,
						duplicatesSkipped: 1,
					},
				})}
			/>,
		);
		expect(
			getByText(`import.doneSubline:{"count":1,"month":"${month}"}`),
		).toBeTruthy();
	});

	it("drops the duplicates clause when none were skipped", async () => {
		const month = new Date(2026, 6, 28).toLocaleDateString(undefined, {
			month: "long",
		});
		const review = doneReview({ excluded: new Set<number>() });
		review.rows = [review.rows[0]];
		const { getByText } = await render(
			<DoneStep onDone={jest.fn()} review={review} />,
		);
		expect(
			getByText(`import.doneSublineNoDuplicates:{"month":"${month}"}`),
		).toBeTruthy();
	});

	it("shows the added count and out amount in the measure strip", async () => {
		const { getByText } = await render(
			<DoneStep onDone={jest.fn()} review={doneReview()} />,
		);
		expect(getByText("import.doneAddedLabel")).toBeTruthy();
		expect(getByText("12")).toBeTruthy();
		expect(getByText("log.measure.out")).toBeTruthy();
		expect(getByText("-$348.40")).toBeTruthy();
	});

	it("dismisses through the ghost Done button", async () => {
		const onDone = jest.fn();
		const { getByTestId } = await render(
			<DoneStep onDone={onDone} review={doneReview()} />,
		);
		fireEvent.press(getByTestId("import-done-cta"));
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it("centers the stamp block inside an explicit min height, not an inert flex fill", async () => {
		const { toJSON } = await render(
			<DoneStep onDone={jest.fn()} review={doneReview()} />,
		);
		const classes = classNames(toJSON() as unknown as JsonNode);
		expect(
			classes.some(
				(c) => /\bmin-h-\d+\b/.test(c) && /\bjustify-center\b/.test(c),
			),
		).toBe(true);
		expect(
			classes.some((c) => /\bflex-1\b/.test(c) && /\bjustify-center\b/.test(c)),
		).toBe(false);
	});

	it("renders nothing before a commit succeeded", async () => {
		const review = doneReview({ commit: { phase: "idle" } });
		const { toJSON } = await render(
			<DoneStep onDone={jest.fn()} review={review} />,
		);
		expect(toJSON()).toBeNull();
	});
});
