import { fireEvent, render } from "@testing-library/react-native";
import type { ImportEntry } from "@/data/transfer-core";
import type { UseCsvImportResult } from "@/hooks/use-csv-import";
import type { ImportReviewResult } from "@/hooks/use-import-review";
import { importDraftStore } from "@/lib/import-draft-store";
import { ResolveStep } from "./resolve-step";

const mockRun = jest.fn();
const mockOpenFeatureLab = jest.fn();

let mockContext: UseCsvImportResult;

function baseContext(
	overrides: Partial<UseCsvImportResult> = {},
): UseCsvImportResult {
	return {
		running: false,
		outcome: null,
		reason: null,
		links: new Map(),
		fromModel: new Set(),
		totalLabels: 24,
		tier1Matched: 0,
		tier2Sent: 0,
		run: mockRun,
		...overrides,
	};
}

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
		tint: "#3366FF",
	}),
}));
jest.mock("@/contexts/csv-import-context", () => ({
	useCsvImportContext: () => mockContext,
}));

const ENTRY: ImportEntry = {
	note: "Bakery",
	categoryId: "cat-food",
	income: false,
	amount: 12.5,
	currency: null,
	date: new Date(2026, 6, 28),
} as ImportEntry;

function reviewWith(entries: ImportEntry[]): ImportReviewResult {
	return {
		plan: { entries, skipped: [], earliest: null, latest: null },
		rows: [],
		excluded: new Set(),
		selectedCount: entries.length,
		categoryName: new Map(),
		categoryTile: new Map(),
		currency: "USD",
		commit: { phase: "idle" },
		onToggle: jest.fn(),
		onCommit: jest.fn(),
	};
}

function loadFile() {
	importDraftStore.dispatch({ type: "sourceSelected", sourceId: "csv" });
	importDraftStore.dispatch({
		type: "fileParsed",
		file: { name: "bank.csv", chars: 42 },
		parsed: {
			header: ["date", "note", "amount"],
			rows: [
				["13/08/2026", "Coffee", "3.50"],
				["14/08/2026", "Bakery", "5.00"],
			],
			width: 3,
		},
		draft: {
			category: 1,
			note: 1,
			date: 0,
			amount: 2,
			currency: null,
			type: null,
		},
		resolved: {
			mapping: {
				category: 1,
				note: 1,
				date: 0,
				amount: 2,
				currency: null,
				type: null,
			},
			labelSource: "descriptionColumn",
		},
		gaps: [],
	});
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

describe("ResolveStep", () => {
	beforeEach(() => {
		mockRun.mockClear();
		mockOpenFeatureLab.mockClear();
		importDraftStore.clear();
		mockContext = baseContext();
	});

	it("shows the eyebrow with filename and row count, the checklist, and the privacy footnote", async () => {
		loadFile();
		const { getByText } = await render(
			<ResolveStep
				onOpenFeatureLab={mockOpenFeatureLab}
				review={reviewWith([])}
			/>,
		);

		expect(getByText("bank.csv")).toBeTruthy();
		expect(getByText('import.resolveEyebrowRows:{"count":2}')).toBeTruthy();
		expect(getByText("import.resolveRunningReadFile")).toBeTruthy();
		expect(getByText("import.resolveRunningMatched")).toBeTruthy();
		expect(getByText("import.resolveRunningAsked")).toBeTruthy();
		expect(getByText("import.resolveFootnote")).toBeTruthy();
	});

	it("auto-runs the resolution when idle", async () => {
		loadFile();
		await render(
			<ResolveStep
				onOpenFeatureLab={mockOpenFeatureLab}
				review={reviewWith([])}
			/>,
		);
		expect(mockRun).toHaveBeenCalledTimes(1);
	});

	it("does not re-run once an outcome settled", async () => {
		loadFile();
		mockContext = baseContext({ outcome: "applied" });
		await render(
			<ResolveStep
				onOpenFeatureLab={mockOpenFeatureLab}
				review={reviewWith([])}
			/>,
		);
		expect(mockRun).not.toHaveBeenCalled();
	});

	it("advances to review through the store once applied with entries", async () => {
		loadFile();
		importDraftStore.setStep("resolve");
		mockContext = baseContext({ outcome: "applied" });
		await render(
			<ResolveStep
				onOpenFeatureLab={mockOpenFeatureLab}
				review={reviewWith([ENTRY])}
			/>,
		);
		expect(importDraftStore.getSnapshot().ui.step).toBe("review");
	});

	it("stays on resolve when applied lands zero entries", async () => {
		loadFile();
		importDraftStore.setStep("resolve");
		mockContext = baseContext({ outcome: "applied" });
		await render(
			<ResolveStep
				onOpenFeatureLab={mockOpenFeatureLab}
				review={reviewWith([])}
			/>,
		);
		expect(importDraftStore.getSnapshot().ui.step).toBe("resolve");
	});

	it("shows the unavailable reason with a retry", async () => {
		loadFile();
		mockContext = baseContext({ outcome: "unavailable", reason: "timeout" });
		const { getByText } = await render(
			<ResolveStep
				onOpenFeatureLab={mockOpenFeatureLab}
				review={reviewWith([])}
			/>,
		);

		expect(getByText("import.unavailableTitle")).toBeTruthy();
		expect(getByText("import.unavailableTimeout")).toBeTruthy();
		fireEvent.press(getByText("import.tryAgain"));
		expect(mockRun).toHaveBeenCalled();
	});

	it("offers no retry for a no-retry reason", async () => {
		loadFile();
		mockContext = baseContext({ outcome: "unavailable", reason: "overCap" });
		const { queryByText } = await render(
			<ResolveStep
				onOpenFeatureLab={mockOpenFeatureLab}
				review={reviewWith([])}
			/>,
		);
		expect(queryByText("import.tryAgain")).toBeNull();
	});

	it("spaces the review CTA with a fixed margin, not an inert flex spacer", async () => {
		loadFile();
		importDraftStore.setStep("resolve");
		mockContext = baseContext({ outcome: "applied" });
		const { toJSON } = await render(
			<ResolveStep
				onOpenFeatureLab={mockOpenFeatureLab}
				review={reviewWith([ENTRY])}
			/>,
		);
		const classes = classNames(toJSON() as unknown as JsonNode);
		expect(classes).not.toContain("flex-1");
		expect(classes.some((c) => /\bmt-6\b/.test(c))).toBe(true);
	});

	it("routes the declined branch through onOpenFeatureLab", async () => {
		loadFile();
		mockContext = baseContext({ outcome: "declined" });
		const { getByText } = await render(
			<ResolveStep
				onOpenFeatureLab={mockOpenFeatureLab}
				review={reviewWith([])}
			/>,
		);

		expect(getByText("import.declinedBody")).toBeTruthy();
		fireEvent.press(getByText("import.openFeatureLab"));
		expect(mockOpenFeatureLab).toHaveBeenCalledTimes(1);
	});
});
