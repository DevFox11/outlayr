import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import type { ImportReviewResult } from "@/hooks/use-import-review";
import { EntryRow, ReviewStep } from "./review-step";

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string, params?: Record<string, unknown>) =>
		params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		foreground: "#17150F",
		background: "#F2F0EA",
		muted: "#8A8578",
		subtle: "#B4AFA0",
		income: "#2E7D32",
		danger: "#B5482F",
	}),
}));
jest.mock("@/contexts/app-theme-context", () => ({
	useAppTheme: () => ({ isDark: false }),
}));
jest.mock("@/contexts/display-settings-context", () => ({
	useDisplaySettings: () => ({
		state: { showCents: true, showSign: true },
	}),
}));
jest.mock("@/hooks/use-review-enrichment", () => ({
	useReviewEnrichment: (entries: readonly { note: string }[]) =>
		new Map(
			entries.map((entry, index) => [
				index,
				{ displayName: `clean:${entry.note}`, logoUri: null },
			]),
		),
}));
jest.mock("@legendapp/list/section-list", () => {
	const { View: RNView } = require("react-native");
	interface MockSection {
		key: string;
		data: unknown[];
	}
	return {
		SectionList: ({
			sections,
			renderItem,
			renderSectionHeader,
			keyExtractor,
			ListFooterComponent,
		}: {
			sections: MockSection[];
			renderItem: (info: { item: unknown; index: number }) => ReactNode;
			renderSectionHeader: (info: { section: MockSection }) => ReactNode;
			keyExtractor: (item: unknown, index: number) => string;
			ListFooterComponent?: ReactNode;
		}) => (
			<RNView testID="legend-list">
				{sections.map((section) => (
					<RNView key={section.key}>
						{renderSectionHeader({ section })}
						{section.data.map((item, index) => (
							<RNView key={keyExtractor(item, index)}>
								{renderItem({ item, index })}
							</RNView>
						))}
					</RNView>
				))}
				{ListFooterComponent}
			</RNView>
		),
	};
});

const ENTRY = {
	note: "Bakery",
	categoryId: "cat-food",
	income: false,
	amount: 12.5,
	currency: null,
	date: new Date(2026, 6, 28),
};

const OTHER_DAY_ENTRY = {
	...ENTRY,
	note: "Salary",
	categoryId: "cat-pay",
	income: true,
	amount: 2400,
	date: new Date(2026, 6, 27),
};

const TILE = { color: "#3D8A4E", icon: "basket", emoji: null };

function entryRowProps(
	overrides: Partial<Parameters<typeof EntryRow>[0]> = {},
) {
	return {
		index: 0,
		entry: ENTRY,
		duplicate: false,
		checked: true,
		categoryName: "Groceries",
		tile: TILE,
		displayName: "Bakery Corner",
		logoUri: null,
		currency: "USD",
		onToggle: jest.fn(),
		...overrides,
	};
}

interface JsonNode {
	type?: string;
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

describe("EntryRow", () => {
	it("renders the enriched name, category subline, date and ledger-formatted amount", async () => {
		const { getByText } = await render(<EntryRow {...entryRowProps()} />);

		expect(getByText("Bakery Corner")).toBeTruthy();
		expect(getByText("Groceries")).toBeTruthy();
		expect(
			getByText(
				ENTRY.date.toLocaleDateString(undefined, {
					day: "numeric",
					month: "short",
				}),
			),
		).toBeTruthy();
		expect(getByText("-$12.50")).toBeTruthy();
	});

	it("marks income green-signed the way the ledger does", async () => {
		const { getByText } = await render(
			<EntryRow
				{...entryRowProps({ entry: { ...ENTRY, income: true, amount: 2400 } })}
			/>,
		);
		expect(getByText("+$2,400.00")).toBeTruthy();
	});

	it("shows the duplicate warning subline instead of the category line", async () => {
		const { getByText, queryByText } = await render(
			<EntryRow {...entryRowProps({ duplicate: true, checked: false })} />,
		);
		expect(getByText("import.reviewDuplicateCaption")).toBeTruthy();
		expect(queryByText("Groceries")).toBeNull();
	});

	it("toggles from a plain row tap, keeping the rowToggled event", async () => {
		const onToggle = jest.fn();
		const { getByTestId } = await render(
			<EntryRow {...entryRowProps({ index: 3, onToggle })} />,
		);
		fireEvent.press(getByTestId("review-row-3"));
		expect(onToggle).toHaveBeenCalledWith(3);
	});

	it("dims and strikes the excluded state", async () => {
		const screen = await render(
			<EntryRow {...entryRowProps({ checked: false })} />,
		);
		const names = classNames(screen.toJSON() as unknown as JsonNode);
		expect(names.some((name) => /\bopacity-40\b/.test(name))).toBe(true);
		expect(names.some((name) => /\bline-through\b/.test(name))).toBe(true);
	});

	it("keeps the included state unstruck", async () => {
		const screen = await render(<EntryRow {...entryRowProps()} />);
		const names = classNames(screen.toJSON() as unknown as JsonNode);
		expect(names.some((name) => /\bline-through\b/.test(name))).toBe(false);
	});
});

describe("ReviewStep", () => {
	function baseReview(
		overrides: Partial<ImportReviewResult> = {},
	): ImportReviewResult {
		return {
			plan: {
				entries: [ENTRY],
				skipped: [],
				earliest: null,
				latest: null,
			},
			rows: [
				{
					kind: "entry",
					key: "entry-0",
					index: 0,
					entry: ENTRY,
					duplicate: false,
				},
			],
			excluded: new Set<number>(),
			selectedCount: 1,
			categoryName: new Map([["cat-food", "Groceries"]]),
			categoryTile: new Map([["cat-food", TILE]]),
			currency: "USD",
			commit: { phase: "idle" },
			onToggle: jest.fn(),
			onCommit: jest.fn(),
			...overrides,
		} as ImportReviewResult;
	}

	it("pins the measure strip with the live selection count and out total", async () => {
		const { getAllByText, getByText } = await render(
			<ReviewStep review={baseReview()} />,
		);
		expect(getByText("import.reviewToImportLabel")).toBeTruthy();
		expect(
			getByText('import.reviewToImportValue:{"count":1,"total":1}'),
		).toBeTruthy();
		expect(getByText("log.measure.out")).toBeTruthy();
		expect(getAllByText("-$12.50").length).toBeGreaterThanOrEqual(2);
	});

	it("excludes toggled-off rows from the out total", async () => {
		const review = baseReview({ excluded: new Set([0]), selectedCount: 0 });
		const { getByText } = await render(<ReviewStep review={review} />);
		expect(getByText("-$0.00")).toBeTruthy();
	});

	it("orders day sections newest-first regardless of file order", async () => {
		const older = { ...ENTRY, note: "Older", date: new Date(2026, 6, 20) };
		const newer = { ...ENTRY, note: "Newer", date: new Date(2026, 6, 29) };
		const review = baseReview({
			plan: {
				entries: [older, newer],
				skipped: [],
				earliest: null,
				latest: null,
			},
			rows: [
				{
					kind: "entry",
					key: "entry-0",
					index: 0,
					entry: older,
					duplicate: false,
				},
				{
					kind: "entry",
					key: "entry-1",
					index: 1,
					entry: newer,
					duplicate: false,
				},
			],
			selectedCount: 2,
		});
		const screen = await render(<ReviewStep review={review} />);
		const serialized = JSON.stringify(screen.toJSON());
		expect(serialized.indexOf("clean:Newer")).toBeLessThan(
			serialized.indexOf("clean:Older"),
		);
	});

	it("groups entries under day headers with live included totals", async () => {
		const review = baseReview({
			plan: {
				entries: [ENTRY, OTHER_DAY_ENTRY],
				skipped: [],
				earliest: null,
				latest: null,
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
					entry: OTHER_DAY_ENTRY,
					duplicate: false,
				},
			],
			selectedCount: 2,
		});
		const screen = await render(<ReviewStep review={review} />);
		const serialized = JSON.stringify(screen.toJSON());
		expect(serialized).toContain("-$12.50");
		expect(serialized).toContain("+$2,400.00");
		const dayRules = classNames(screen.toJSON() as unknown as JsonNode).filter(
			(name) => name === "bg-border",
		);
		expect(dayRules.length).toBeGreaterThanOrEqual(2);
	});

	it("collapses skipped rows behind the footnote toggle", async () => {
		const review = baseReview({
			plan: {
				entries: [ENTRY],
				skipped: [{ row: 3, reason: "amount" }],
				earliest: null,
				latest: null,
			},
			rows: [
				{
					kind: "entry",
					key: "entry-0",
					index: 0,
					entry: ENTRY,
					duplicate: false,
				},
				{ kind: "header", key: "skipped-header", count: 1 },
				{ kind: "skipped", key: "skipped-3", row: 3, reason: "amount" },
			],
		});
		const { findByText, getByTestId, getByText, queryByText } = await render(
			<ReviewStep review={review} />,
		);

		expect(getByText('import.reviewSkippedShow:{"count":1}')).toBeTruthy();
		expect(queryByText("import.skipReasonAmount")).toBeNull();

		fireEvent.press(getByTestId("review-skipped-toggle"));
		expect(await findByText("import.skipReasonAmount")).toBeTruthy();
		expect(
			await findByText('import.reviewSkippedHide:{"count":1}'),
		).toBeTruthy();
	});

	it("starts a duplicate unchecked, driven by the excluded set", async () => {
		const review = baseReview({
			rows: [
				{
					kind: "entry",
					key: "entry-0",
					index: 0,
					entry: ENTRY,
					duplicate: true,
				},
			],
			excluded: new Set([0]),
			selectedCount: 0,
		});
		const { getByTestId } = await render(<ReviewStep review={review} />);
		expect(getByTestId("review-row-0").props.accessibilityState.checked).toBe(
			false,
		);
	});

	it("renders the empty state when there is nothing to import", async () => {
		const review = baseReview({ rows: [], selectedCount: 0 });
		const { getByText } = await render(<ReviewStep review={review} />);
		expect(getByText("import.reviewEmptyTitle")).toBeTruthy();
	});

	it("keeps the inline two-tap commit CTA", async () => {
		const onCommit = jest.fn();
		const review = baseReview({ onCommit });
		const { findByText, getByTestId } = await render(
			<ReviewStep review={review} />,
		);

		fireEvent.press(getByTestId("review-commit-cta"));
		expect(onCommit).not.toHaveBeenCalled();
		expect(
			await findByText('import.reviewCommitConfirmCta:{"count":1}'),
		).toBeTruthy();

		fireEvent.press(getByTestId("review-commit-cta"));
		expect(onCommit).toHaveBeenCalledTimes(1);
	});

	it("renders the commit-failed banner ruled, with Try again as the CTA label", async () => {
		const review = baseReview({
			commit: { phase: "failed", detail: "disk full" },
		});
		const { getByTestId, getByText } = await render(
			<ReviewStep review={review} />,
		);
		expect(getByTestId("review-commit-failed")).toBeTruthy();
		expect(getByText("import.reviewCommitFailedTitle")).toBeTruthy();
		expect(getByText("disk full")).toBeTruthy();
		expect(getByText("import.tryAgain")).toBeTruthy();
	});

	it("draws no card washes anywhere", async () => {
		const screen = await render(<ReviewStep review={baseReview()} />);
		const washed = classNames(screen.toJSON() as unknown as JsonNode).filter(
			(name) =>
				/\bbg-(background|surface|card|foreground\/\d+)\b/.test(name) ||
				/\brounded-(xl|2xl)\b/.test(name),
		);
		expect(washed).toStrictEqual([]);
	});
});
