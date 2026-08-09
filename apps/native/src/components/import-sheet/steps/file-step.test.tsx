import { fireEvent, render } from "@testing-library/react-native";
import type { ResolvedMapping } from "@/domain/import-mapping";
import { importDraftStore } from "@/lib/import-draft-store";
import { FileStep } from "./file-step";

const mockChoose = jest.fn();

jest.mock("@/i18n/context", () => ({
	useTranslation: () => (key: string, params?: Record<string, unknown>) =>
		params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		background: "#F2F0EA",
		danger: "#B5482F",
		foreground: "#17150F",
		income: "#2E7D32",
		muted: "#8A8578",
		subtle: "#B4AFA0",
	}),
}));

const RESOLVED_MAPPING: ResolvedMapping = {
	labelSource: "descriptionColumn",
	mapping: {
		amount: 2,
		category: 1,
		currency: null,
		date: 0,
		note: 1,
		type: null,
	},
};

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

function loadFile(gaps: readonly string[], resolved: ResolvedMapping | null) {
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
		gaps: gaps as never,
		parsed: {
			header: ["date", "description", "amount"],
			rows: [["13/08/2026", "Coffee", "3,50"]],
			width: 3,
		},
		resolved,
		type: "fileParsed",
	});
}

describe("FileStep", () => {
	beforeEach(() => {
		mockChoose.mockClear();
		importDraftStore.clear();
	});

	it("renders the empty state with its own Choose CSV pill", async () => {
		const { getByText } = await render(<FileStep onChoose={mockChoose} />);
		expect(getByText("import.fileEmptyCaption")).toBeTruthy();
		expect(getByText("import.fileOnDeviceNote")).toBeTruthy();

		fireEvent.press(getByText("import.chooseCsv"));
		expect(mockChoose).toHaveBeenCalledTimes(1);
	});

	it("previews the loaded shape as a ghost measure strip, not an illustration", async () => {
		const { getAllByText, getByText, queryByTestId } = await render(<FileStep onChoose={mockChoose} />);
		expect(getByText("import.fileRowsLabel")).toBeTruthy();
		expect(getByText("import.fileColumnsLabel")).toBeTruthy();
		expect(getByText("import.fileDatesLabel")).toBeTruthy();
		expect(getAllByText("—").length).toBeGreaterThanOrEqual(3);
		expect(queryByTestId("import-file-empty-mark")).toBeNull();
	});

	it("draws ruled rows, never card washes", async () => {
		loadFile([], RESOLVED_MAPPING);
		const { toJSON } = await render(<FileStep onChoose={mockChoose} />);
		const washed = classNames(toJSON() as unknown as JsonNode).filter(
			(className) =>
				/\bbg-(background|surface|card|foreground\/\d+)\b/.test(className) || /\brounded-(xl|2xl)\b/.test(className)
		);
		expect(washed).toStrictEqual([]);
	});

	it("shows the error block with the Choose CSV pill as the retry", async () => {
		importDraftStore.setFileError({ cause: "empty" });
		const { getByText } = await render(<FileStep onChoose={mockChoose} />);
		expect(getByText("import.errorEmptyTitle")).toBeTruthy();
		expect(getByText("import.errorEmptyBody")).toBeTruthy();

		fireEvent.press(getByText("import.chooseCsv"));
		expect(mockChoose).toHaveBeenCalledTimes(1);
	});

	it("spaces the error retry with a fixed margin, not an inert flex spacer", async () => {
		importDraftStore.setFileError({ cause: "empty" });
		const { toJSON } = await render(<FileStep onChoose={mockChoose} />);
		const classes = classNames(toJSON() as unknown as JsonNode);
		expect(classes.some(isPureFlexFill)).toBe(false);
		expect(classes.some((c) => /\bmt-6\b/.test(c))).toBe(true);
	});

	it("shows the io error body from the thrown key", async () => {
		importDraftStore.setFileError({
			cause: "io",
			key: "alerts.transfer.unreadableFile",
		});
		const { getByText } = await render(<FileStep onChoose={mockChoose} />);
		expect(getByText("import.errorIoTitle")).toBeTruthy();
		expect(getByText("alerts.transfer.unreadableFile")).toBeTruthy();
	});

	it("names each mapping gap and re-invokes the picker from Choose a different file", async () => {
		loadFile(["noLabelColumn"], null);
		const { getByText } = await render(<FileStep onChoose={mockChoose} />);

		expect(getByText("import.mappingGapTitle")).toBeTruthy();
		expect(getByText("import.mappingGapNoLabel")).toBeTruthy();
		expect(getByText("import.mappingGapGuidance")).toBeTruthy();

		fireEvent.press(getByText("import.chooseDifferentFile"));
		expect(mockChoose).toHaveBeenCalledTimes(1);
	});

	it("shows the loaded file row with the on-device caption and the measure strip", async () => {
		loadFile([], RESOLVED_MAPPING);
		const { getByText } = await render(<FileStep onChoose={mockChoose} />);

		expect(getByText("bank.csv")).toBeTruthy();
		expect(getByText("import.fileReadOnDevice")).toBeTruthy();
		expect(getByText("import.fileRowsLabel")).toBeTruthy();
		expect(getByText("import.fileColumnsLabel")).toBeTruthy();
		expect(getByText("import.fileDatesLabel")).toBeTruthy();
		expect(getByText("dd/MM/yyyy")).toBeTruthy();

		fireEvent.press(getByText("import.chooseDifferentFile"));
		expect(mockChoose).toHaveBeenCalledTimes(1);
	});

	it("advances to resolve from the loaded state's Continue", async () => {
		loadFile([], RESOLVED_MAPPING);
		const { getByTestId } = await render(<FileStep onChoose={mockChoose} />);

		fireEvent.press(getByTestId("import-file-continue"));
		expect(importDraftStore.getSnapshot().ui.step).toBe("resolve");
	});

	it("shows the description-column note only when that column supplied the label", async () => {
		loadFile([], RESOLVED_MAPPING);
		const { getByText } = await render(<FileStep onChoose={mockChoose} />);
		expect(getByText("import.fileNoCategoryColumn")).toBeTruthy();
	});

	it("hides the description-column note when the category column supplied the label", async () => {
		loadFile([], { ...RESOLVED_MAPPING, labelSource: "categoryColumn" });
		const { queryByText } = await render(<FileStep onChoose={mockChoose} />);
		expect(queryByText("import.fileNoCategoryColumn")).toBeNull();
	});
});
