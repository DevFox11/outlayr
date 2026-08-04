import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ResolvedMapping } from "@/domain/import-mapping";
import { TransferError } from "@/lib/data-transfer";
import { importDraftStore } from "@/lib/import-draft-store";
import { FileStep } from "./file-step";

const mockPickCsvFile = jest.fn();

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string, params?: Record<string, unknown>) =>
		params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		foreground: "#17150F",
		muted: "#8A8578",
		subtle: "#B4AFA0",
		danger: "#B5482F",
	}),
}));
jest.mock("@/lib/data-transfer", () => {
	const actual = jest.requireActual("@/lib/data-transfer");
	return {
		...actual,
		pickCsvFile: (...args: unknown[]) => mockPickCsvFile(...args),
	};
});

const RESOLVED_MAPPING: ResolvedMapping = {
	mapping: {
		category: 1,
		note: 1,
		date: 0,
		amount: 2,
		currency: null,
		type: null,
	},
	labelSource: "descriptionColumn",
};

describe("FileStep", () => {
	beforeEach(() => {
		mockPickCsvFile.mockReset();
		importDraftStore.clear();
	});

	it("renders the empty state with no file chosen", async () => {
		const { getByText } = await render(<FileStep />);
		expect(getByText("import.fileEmptyCaption")).toBeTruthy();
		expect(getByText("import.chooseCsv")).toBeTruthy();
	});

	it("shows a loading indicator while pickCsvFile is pending", async () => {
		let resolvePick!: (value: null) => void;
		mockPickCsvFile.mockReturnValue(
			new Promise((resolve) => {
				resolvePick = resolve;
			}),
		);
		const { getByText, queryByText, toJSON } = await render(<FileStep />);
		fireEvent.press(getByText("import.chooseCsv"));

		await waitFor(() => {
			expect(queryByText("import.chooseCsv")).toBeNull();
		});
		expect(JSON.stringify(toJSON())).toContain("ActivityIndicator");

		await act(async () => {
			resolvePick(null);
		});
	});

	it("keeps the step untouched when the user cancels the picker", async () => {
		mockPickCsvFile.mockResolvedValue(null);
		const { getByText } = await render(<FileStep />);

		fireEvent.press(getByText("import.chooseCsv"));

		await waitFor(() => {
			expect(importDraftStore.getSnapshot().ui.fileError).toBeNull();
		});
		expect(importDraftStore.getSnapshot().flow.parsed).toBeNull();
		expect(getByText("import.fileEmptyCaption")).toBeTruthy();
	});

	it("dispatches fileParsed with the resolved mapping on a successful pick, clearing any prior error first", async () => {
		importDraftStore.dispatch({ type: "sourceSelected", sourceId: "csv" });
		importDraftStore.setFileError({ cause: "empty" });
		mockPickCsvFile.mockResolvedValue({
			name: "bank.csv",
			text: "date,description,amount\n01/08/2026,Coffee,3,50\n",
		});
		const { getByText } = await render(<FileStep />);

		fireEvent.press(getByText("import.chooseCsv"));

		await waitFor(() => {
			expect(importDraftStore.getSnapshot().flow.parsed).not.toBeNull();
		});
		expect(importDraftStore.getSnapshot().flow.mappingGaps).toStrictEqual([]);
		expect(importDraftStore.getSnapshot().flow.resolved?.labelSource).toBe(
			"descriptionColumn",
		);
		expect(importDraftStore.getSnapshot().ui.fileError).toBeNull();
	});

	it("shows the I/O error inline via store.ui.fileError, with the translated error key as its body, and allows retry", async () => {
		mockPickCsvFile.mockRejectedValue(
			new TransferError("alerts.transfer.unreadableFile"),
		);
		const { getByText } = await render(<FileStep />);

		fireEvent.press(getByText("import.chooseCsv"));

		await waitFor(() => {
			expect(getByText("import.errorIoTitle")).toBeTruthy();
		});
		expect(getByText("alerts.transfer.unreadableFile")).toBeTruthy();
		expect(getByText("import.chooseCsv")).toBeTruthy();
		expect(importDraftStore.getSnapshot().ui.fileError).toStrictEqual({
			cause: "io",
			key: "alerts.transfer.unreadableFile",
		});
	});

	it("classifies an empty file", async () => {
		mockPickCsvFile.mockResolvedValue({ name: "empty.csv", text: "" });
		const { getByText } = await render(<FileStep />);

		fireEvent.press(getByText("import.chooseCsv"));

		await waitFor(() => {
			expect(getByText("import.errorEmptyTitle")).toBeTruthy();
		});
	});

	it("classifies a header-only file with no data rows", async () => {
		mockPickCsvFile.mockResolvedValue({
			name: "header-only.csv",
			text: "date,description,amount\n",
		});
		const { getByText } = await render(<FileStep />);

		fireEvent.press(getByText("import.chooseCsv"));

		await waitFor(() => {
			expect(getByText("import.errorNoDataTitle")).toBeTruthy();
		});
	});

	it("classifies a file with fewer than 3 columns", async () => {
		mockPickCsvFile.mockResolvedValue({
			name: "two-col.csv",
			text: "a,b\n1,2\n",
		});
		const { getByText } = await render(<FileStep />);

		fireEvent.press(getByText("import.chooseCsv"));

		await waitFor(() => {
			expect(getByText("import.errorTooFewColumnsTitle")).toBeTruthy();
		});
	});

	it("rejects a file over the hard parse cap before parsing", async () => {
		mockPickCsvFile.mockResolvedValue({
			name: "huge.csv",
			text: "a".repeat(20_000_001),
		});
		const { getByText } = await render(<FileStep />);

		fireEvent.press(getByText("import.chooseCsv"));

		await waitFor(() => {
			expect(getByText("import.errorTooLargeTitle")).toBeTruthy();
		});
	});

	it("shows the mapping-gap card before any AI consideration, naming each gap and giving actionable guidance instead of a dead end", async () => {
		importDraftStore.dispatch({ type: "sourceSelected", sourceId: "csv" });
		importDraftStore.dispatch({
			type: "fileParsed",
			file: { name: "bank.csv", chars: 10 },
			parsed: {
				header: ["date", "amount", "balance"],
				rows: [["01/08/2026", "3,50", "100"]],
				width: 3,
			},
			draft: {
				category: null,
				note: null,
				date: 0,
				amount: 1,
				currency: null,
				type: null,
			},
			resolved: null,
			gaps: ["noLabelColumn"],
		});

		const { getByText, queryByText } = await render(<FileStep />);

		expect(getByText("import.mappingGapTitle")).toBeTruthy();
		expect(getByText("import.mappingGapNoLabel")).toBeTruthy();
		expect(getByText("import.mappingGapGuidance")).toBeTruthy();
		expect(queryByText("import.mapManually")).toBeNull();
		expect(getByText("import.chooseDifferentFile")).toBeTruthy();
	});

	it("re-invokes the picker from the mapping-gap state's Choose a different file, replacing the gap with a resolved file", async () => {
		importDraftStore.dispatch({ type: "sourceSelected", sourceId: "csv" });
		importDraftStore.dispatch({
			type: "fileParsed",
			file: { name: "bank.csv", chars: 10 },
			parsed: {
				header: ["date", "amount", "balance"],
				rows: [["01/08/2026", "3,50", "100"]],
				width: 3,
			},
			draft: {
				category: null,
				note: null,
				date: 0,
				amount: 1,
				currency: null,
				type: null,
			},
			resolved: null,
			gaps: ["noLabelColumn"],
		});
		mockPickCsvFile.mockResolvedValue({
			name: "fixed.csv",
			text: "date,description,amount\n01/08/2026,Coffee,3,50\n",
		});

		const { getByText } = await render(<FileStep />);
		fireEvent.press(getByText("import.chooseDifferentFile"));

		await waitFor(() => {
			expect(importDraftStore.getSnapshot().flow.mappingGaps).toStrictEqual([]);
		});
		expect(importDraftStore.getSnapshot().flow.file?.name).toBe("fixed.csv");
	});

	it("shows the 4th line only when the label source is the description column", async () => {
		importDraftStore.dispatch({ type: "sourceSelected", sourceId: "csv" });
		importDraftStore.dispatch({
			type: "fileParsed",
			file: { name: "bank.csv", chars: 42 },
			parsed: {
				header: ["date", "description", "amount"],
				rows: [["01/08/2026", "Coffee", "3,50"]],
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
			resolved: RESOLVED_MAPPING,
			gaps: [],
		});

		const { getByText } = await render(<FileStep />);
		expect(getByText("import.fileNoCategoryColumn")).toBeTruthy();
	});

	it("hides the 4th line when the category column supplied the label", async () => {
		importDraftStore.dispatch({ type: "sourceSelected", sourceId: "csv" });
		importDraftStore.dispatch({
			type: "fileParsed",
			file: { name: "bank.csv", chars: 42 },
			parsed: {
				header: ["date", "category", "description", "amount"],
				rows: [["01/08/2026", "Food", "Coffee", "3,50"]],
				width: 4,
			},
			draft: {
				category: 1,
				note: 2,
				date: 0,
				amount: 3,
				currency: null,
				type: null,
			},
			resolved: { ...RESOLVED_MAPPING, labelSource: "categoryColumn" },
			gaps: [],
		});

		const { queryByText } = await render(<FileStep />);
		expect(queryByText("import.fileNoCategoryColumn")).toBeNull();
	});
});
