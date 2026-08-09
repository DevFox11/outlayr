import { fireEvent, render } from "@testing-library/react-native";
import type { ImportEntry } from "@/data/transfer-core";
import type { UseCsvImportResult } from "@/hooks/use-csv-import";
import type { ImportReviewResult } from "@/hooks/use-import-review";
import { importDraftStore } from "@/lib/import-draft-store";
import { askedStatus, matchedStatus, ResolveStep } from "./resolve-step";

const mockRun = jest.fn();
const mockOpenFeatureLab = jest.fn();

let mockContext: UseCsvImportResult;

function baseContext(overrides: Partial<UseCsvImportResult> = {}): UseCsvImportResult {
	return {
		fromModel: new Set(),
		links: new Map(),
		outcome: null,
		reason: null,
		run: mockRun,
		running: false,
		stage: "idle",
		tier1Matched: 0,
		tier2Sent: 0,
		totalLabels: 24,
		...overrides,
	};
}

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string, params?: Record<string, unknown>) =>
		params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		danger: "#B5482F",
		foreground: "#17150F",
		income: "#2E7D32",
		muted: "#8A8578",
		subtle: "#B4AFA0",
		tint: "#3366FF",
	}),
}));
jest.mock("@/contexts/csv-import-context", () => ({
	useCsvImportContext: () => mockContext,
}));

const ENTRY: ImportEntry = {
	amount: 12.5,
	categoryId: "cat-food",
	currency: null,
	date: new Date(2026, 6, 28),
	income: false,
	note: "Bakery",
} as ImportEntry;

function reviewWith(entries: ImportEntry[]): ImportReviewResult {
	return {
		categoryName: new Map(),
		categoryTile: new Map(),
		commit: { phase: "idle" },
		currency: "USD",
		excluded: new Set(),
		onCommit: jest.fn(),
		onToggle: jest.fn(),
		plan: { earliest: null, entries, latest: null, skipped: [] },
		rows: [],
		selectedCount: entries.length,
	};
}

function loadFile() {
	importDraftStore.dispatch({ sourceId: "csv", type: "sourceSelected" });
	importDraftStore.dispatch({
		draft: {
			amount: 2,
			category: 1,
			currency: null,
			date: 0,
			note: 1,
			type: null,
		},
		file: { chars: 42, name: "bank.csv" },
		gaps: [],
		parsed: {
			header: ["date", "note", "amount"],
			rows: [
				["13/08/2026", "Coffee", "3.50"],
				["14/08/2026", "Bakery", "5.00"],
			],
			width: 3,
		},
		resolved: {
			labelSource: "descriptionColumn",
			mapping: {
				amount: 2,
				category: 1,
				currency: null,
				date: 0,
				note: 1,
				type: null,
			},
		},
		type: "fileParsed",
	});
}

interface JsonNode {
	children?: (JsonNode | string)[] | null;
	props?: Record<string, unknown>;
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
		...(node.children ?? []).flatMap((child) => (typeof child === "string" ? [] : classNames(child))),
	];
}

function isPureFlexFill(className: string): boolean {
	return className
		.trim()
		.split(/\s+/)
		.every((token) => /^(flex-1|grow|grow-0|shrink|shrink-0|basis-\S+)$/.test(token));
}

describe("stage → task status", () => {
	it("keeps the on-device step running until the pipeline moves past it", () => {
		expect(matchedStatus("idle")).toBe("running");
		expect(matchedStatus("matching")).toBe("running");
		expect(matchedStatus("asking")).toBe("complete");
		expect(matchedStatus("settled")).toBe("complete");
	});

	it("holds the model step pending until it is genuinely in flight", () => {
		expect(askedStatus("idle", 0)).toBe("pending");
		expect(askedStatus("matching", 0)).toBe("pending");
		expect(askedStatus("asking", 12)).toBe("running");
	});

	it("ticks the model step only when names actually went out", () => {
		expect(askedStatus("settled", 12)).toBe("complete");
		expect(askedStatus("settled", 0)).toBe("pending");
	});
});

describe("ResolveStep", () => {
	beforeEach(() => {
		mockRun.mockClear();
		mockOpenFeatureLab.mockClear();
		importDraftStore.clear();
		mockContext = baseContext();
	});

	it("names the file once, on the step that read it, with the checklist and the privacy footnote", async () => {
		loadFile();
		const { getAllByText, getByText } = await render(
			<ResolveStep onOpenFeatureLab={mockOpenFeatureLab} review={reviewWith([])} />
		);

		expect(getAllByText("bank.csv")).toHaveLength(1);
		expect(getByText('import.resolveDetailRows:{"count":2}')).toBeTruthy();
		expect(getByText("import.resolveRunningReadFile")).toBeTruthy();
		expect(getByText("import.resolveRunningMatched")).toBeTruthy();
		expect(getByText("import.resolveRunningAsked")).toBeTruthy();
		expect(getByText("import.resolveFootnote")).toBeTruthy();
	});

	it("auto-runs the resolution when idle", async () => {
		loadFile();
		await render(<ResolveStep onOpenFeatureLab={mockOpenFeatureLab} review={reviewWith([])} />);
		expect(mockRun).toHaveBeenCalledTimes(1);
	});

	it("does not re-run once an outcome settled", async () => {
		loadFile();
		mockContext = baseContext({ outcome: "applied" });
		await render(<ResolveStep onOpenFeatureLab={mockOpenFeatureLab} review={reviewWith([])} />);
		expect(mockRun).not.toHaveBeenCalled();
	});

	it("advances to review through the store once applied with entries", async () => {
		loadFile();
		importDraftStore.setStep("resolve");
		mockContext = baseContext({ outcome: "applied" });
		await render(<ResolveStep onOpenFeatureLab={mockOpenFeatureLab} review={reviewWith([ENTRY])} />);
		expect(importDraftStore.getSnapshot().ui.step).toBe("review");
	});

	it("stays on resolve when applied lands zero entries", async () => {
		loadFile();
		importDraftStore.setStep("resolve");
		mockContext = baseContext({ outcome: "applied" });
		await render(<ResolveStep onOpenFeatureLab={mockOpenFeatureLab} review={reviewWith([])} />);
		expect(importDraftStore.getSnapshot().ui.step).toBe("resolve");
	});

	it("shows the unavailable reason with a retry", async () => {
		loadFile();
		mockContext = baseContext({ outcome: "unavailable", reason: "timeout" });
		const { getByText } = await render(<ResolveStep onOpenFeatureLab={mockOpenFeatureLab} review={reviewWith([])} />);

		expect(getByText("import.unavailableTitle")).toBeTruthy();
		expect(getByText("import.unavailableTimeout")).toBeTruthy();
		fireEvent.press(getByText("import.tryAgain"));
		expect(mockRun).toHaveBeenCalled();
	});

	it("offers no retry for a no-retry reason", async () => {
		loadFile();
		mockContext = baseContext({ outcome: "unavailable", reason: "overCap" });
		const { queryByText } = await render(<ResolveStep onOpenFeatureLab={mockOpenFeatureLab} review={reviewWith([])} />);
		expect(queryByText("import.tryAgain")).toBeNull();
	});

	it("spaces the review CTA with a fixed margin, not an inert flex spacer", async () => {
		loadFile();
		importDraftStore.setStep("resolve");
		mockContext = baseContext({ outcome: "applied" });
		const { toJSON } = await render(<ResolveStep onOpenFeatureLab={mockOpenFeatureLab} review={reviewWith([ENTRY])} />);
		const classes = classNames(toJSON() as unknown as JsonNode);
		expect(classes.some(isPureFlexFill)).toBe(false);
		expect(classes.some((c) => /\bmt-6\b/.test(c))).toBe(true);
	});

	it("reports how many merchant names were sent once a run settles", async () => {
		loadFile();
		mockContext = baseContext({
			outcome: "applied",
			stage: "settled",
			tier2Sent: 7,
		});
		const { getByText } = await render(<ResolveStep onOpenFeatureLab={mockOpenFeatureLab} review={reviewWith([])} />);

		expect(getByText('import.resolveDetailSent:{"count":7}')).toBeTruthy();
	});

	it("says nothing left the device when the model was never asked", async () => {
		loadFile();
		mockContext = baseContext({
			outcome: "applied",
			stage: "settled",
			tier2Sent: 0,
		});
		const { getByText } = await render(<ResolveStep onOpenFeatureLab={mockOpenFeatureLab} review={reviewWith([])} />);

		expect(getByText("import.resolveDetailNothingSent")).toBeTruthy();
	});

	it("never fills the filename chip with the muted text colour", async () => {
		loadFile();
		mockContext = baseContext({ outcome: "applied", stage: "settled" });
		const { toJSON } = await render(<ResolveStep onOpenFeatureLab={mockOpenFeatureLab} review={reviewWith([])} />);
		const chip = classNames(toJSON() as unknown as JsonNode).find((c) => /\bbg-transparent\b/.test(c));
		expect(chip).toBeDefined();
		expect(chip).not.toMatch(/\bbg-muted\b/);
	});

	it("routes the declined branch through onOpenFeatureLab", async () => {
		loadFile();
		mockContext = baseContext({ outcome: "declined" });
		const { getByText } = await render(<ResolveStep onOpenFeatureLab={mockOpenFeatureLab} review={reviewWith([])} />);

		expect(getByText("import.declinedBody")).toBeTruthy();
		fireEvent.press(getByText("import.openFeatureLab"));
		expect(mockOpenFeatureLab).toHaveBeenCalledTimes(1);
	});
});
