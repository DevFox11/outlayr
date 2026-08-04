import { fireEvent, render } from "@testing-library/react-native";
import type { ImportReviewResult } from "@/hooks/use-import-review";
import { EntryRow, ReviewStep, renderReviewRow } from "./review-step";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string, params?: Record<string, unknown>) =>
		params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		foreground: "#17150F",
		muted: "#8A8578",
		subtle: "#B4AFA0",
		income: "#2E7D32",
		danger: "#B5482F",
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

describe("EntryRow", () => {
	it("renders the note, category, signed amount and duplicate caption", async () => {
		const { getByText, queryByText } = await render(
			<EntryRow
				categoryName="Groceries"
				checked={true}
				duplicate={true}
				entry={ENTRY}
				index={0}
				onToggle={jest.fn()}
			/>,
		);

		expect(getByText("Bakery")).toBeTruthy();
		expect(getByText("Groceries")).toBeTruthy();
		expect(getByText("12.50")).toBeTruthy();
		expect(getByText("import.reviewDuplicateCaption")).toBeTruthy();
		expect(queryByText("+12.50")).toBeNull();
	});

	it("signs an income entry's amount", async () => {
		const { getByText } = await render(
			<EntryRow
				categoryName="Paycheck"
				checked
				duplicate={false}
				entry={{ ...ENTRY, income: true, amount: 2400 }}
				index={1}
				onToggle={jest.fn()}
			/>,
		);
		expect(getByText("+2400.00")).toBeTruthy();
	});

	it("presses call onToggle with its own index", async () => {
		const onToggle = jest.fn();
		const { getByTestId } = await render(
			<EntryRow
				categoryName="Groceries"
				checked
				duplicate={false}
				entry={ENTRY}
				index={3}
				onToggle={onToggle}
			/>,
		);
		fireEvent.press(getByTestId("review-row-3"));
		expect(onToggle).toHaveBeenCalledWith(3);
		expect(onToggle).toHaveBeenCalledTimes(1);
	});

	it("does not re-render when rerendered with referentially identical props", async () => {
		const onRender = jest.fn();
		const onToggle = jest.fn();
		const props = {
			categoryName: "Groceries",
			duplicate: false,
			entry: ENTRY,
			index: 0,
			onRender,
			onToggle,
		};
		const { rerender } = await render(<EntryRow {...props} checked={true} />);
		expect(onRender).toHaveBeenCalledTimes(1);

		await rerender(<EntryRow {...props} checked={true} />);
		expect(onRender).toHaveBeenCalledTimes(1);

		await rerender(<EntryRow {...props} checked={false} />);
		expect(onRender).toHaveBeenCalledTimes(2);
	});
});

describe("renderReviewRow", () => {
	function baseReview(
		overrides: Partial<ImportReviewResult> = {},
	): ImportReviewResult {
		return {
			plan: { entries: [], skipped: [], earliest: null, latest: null },
			rows: [],
			excluded: new Set([1]),
			selectedCount: 1,
			categoryName: new Map([["cat-food", "Groceries"]]),
			commit: { phase: "idle" },
			onToggle: jest.fn(),
			onCommit: jest.fn(),
			...overrides,
		};
	}

	it("renders an entry row, unchecked when its index is excluded", async () => {
		const review = baseReview();
		const element = renderReviewRow(
			{
				kind: "entry",
				key: "entry-1",
				index: 1,
				entry: ENTRY,
				duplicate: false,
			},
			review,
		);
		const { getByTestId } = await render(element);
		expect(getByTestId("review-row-checkbox-1")).toBeTruthy();
	});

	it("renders the skipped header with its count and no checkbox", async () => {
		const element = renderReviewRow(
			{ kind: "header", key: "skipped-header", count: 4 },
			baseReview(),
		);
		const { getByText } = await render(element);
		expect(getByText('import.reviewSkippedHeader:{"count":4}')).toBeTruthy();
	});

	it("renders a skipped row with its reason and no checkbox", async () => {
		const element = renderReviewRow(
			{ kind: "skipped", key: "skipped-3", row: 3, reason: "amount" },
			baseReview(),
		);
		const { getByText, queryByTestId } = await render(element);
		expect(getByText("3")).toBeTruthy();
		expect(getByText("import.skipReasonAmount")).toBeTruthy();
		expect(queryByTestId("review-row-checkbox-skipped-3")).toBeNull();
	});
});

describe("ReviewStep", () => {
	function baseReview(
		overrides: Partial<ImportReviewResult> = {},
	): ImportReviewResult {
		return {
			plan: { entries: [], skipped: [], earliest: null, latest: null },
			rows: [
				{
					kind: "entry",
					key: "entry-0",
					index: 0,
					entry: ENTRY,
					duplicate: false,
				},
			],
			excluded: new Set(),
			selectedCount: 1,
			categoryName: new Map(),
			commit: { phase: "idle" },
			onToggle: jest.fn(),
			onCommit: jest.fn(),
			...overrides,
		};
	}

	it("renders the list, keyed by testID, once rows are plannable", async () => {
		const { getByTestId } = await render(<ReviewStep review={baseReview()} />);
		expect(getByTestId("review-list")).toBeTruthy();
	});

	it("shows the failure banner above the list when the commit failed", async () => {
		const { getByText } = await render(
			<ReviewStep
				review={baseReview({
					commit: { phase: "failed", detail: "disk full" },
				})}
			/>,
		);

		expect(getByText("import.reviewCommitFailedTitle")).toBeTruthy();
		expect(getByText("import.reviewCommitFailedBody")).toBeTruthy();
		expect(getByText("disk full")).toBeTruthy();
	});

	it("shows an empty message and no list when nothing is plannable", async () => {
		const { getByText, queryByTestId } = await render(
			<ReviewStep review={baseReview({ rows: [] })} />,
		);

		expect(getByText("import.reviewEmptyTitle")).toBeTruthy();
		expect(queryByTestId("review-list")).toBeNull();
	});
});
