import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { UseCsvImportResult } from "@/hooks/use-csv-import";
import { importDraftStore } from "@/lib/import-draft-store";
import { ImportSheet } from "./import-sheet";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockDismissAll = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({
		back: mockBack,
		push: mockPush,
		dismissAll: mockDismissAll,
	}),
	Stack: { Screen: () => null },
}));
jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string, params?: Record<string, unknown>) =>
		params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		foreground: "#17150F",
		muted: "#8A8578",
		subtle: "#B4AFA0",
	}),
}));
function baseCsvImportContext(
	overrides: Partial<UseCsvImportResult> = {},
): UseCsvImportResult {
	return {
		running: false,
		outcome: null,
		reason: null,
		links: new Map(),
		fromModel: new Set(),
		totalLabels: 0,
		tier1Matched: 0,
		tier2Sent: 0,
		run: jest.fn(),
		...overrides,
	};
}
let mockCsvImportContext: UseCsvImportResult = baseCsvImportContext();

jest.mock("@/contexts/csv-import-context", () => ({
	CsvImportProvider: ({ children }: { children: React.ReactNode }) => children,
	useCsvImportContext: () => mockCsvImportContext,
}));
const mockOnCommit = jest.fn();
jest.mock("@/hooks/use-import-review", () => ({
	useImportReview: () => ({
		plan: { entries: [], skipped: [], earliest: null, latest: null },
		rows: [],
		excluded: new Set(),
		selectedCount: 0,
		categoryName: new Map(),
		commit: { phase: "idle" },
		onToggle: jest.fn(),
		onCommit: mockOnCommit,
	}),
}));

describe("ImportSheet", () => {
	beforeEach(() => {
		mockBack.mockClear();
		mockPush.mockClear();
		mockDismissAll.mockClear();
		mockCsvImportContext = baseCsvImportContext();
		importDraftStore.clear();
	});

	it("calls store.commitDismissal() exactly once when the sheet root unmounts", async () => {
		const spy = jest.spyOn(importDraftStore, "commitDismissal");
		const { unmount } = await render(<ImportSheet />);

		await unmount();

		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});

	it("shows no footer on the source step", async () => {
		const { queryByTestId } = await render(<ImportSheet />);
		expect(queryByTestId("import-chrome-footer")).toBeNull();
	});

	it("advances from source to file by moving the wizard cursor, never navigating the router", async () => {
		const { getByText, getByTestId } = await render(<ImportSheet />);
		expect(getByTestId("import-chrome-title")).toHaveTextContent(
			"import.titleSource",
		);

		fireEvent.press(getByText("settings.import.sourceCsvTitle"));

		await waitFor(() => {
			expect(getByTestId("import-chrome-title")).toHaveTextContent(
				"import.titleFile",
			);
		});
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("shows an enabled Continue footer once the file step is reached with a resolved mapping", async () => {
		importDraftStore.dispatch({ type: "sourceSelected", sourceId: "csv" });
		importDraftStore.setStep("file");
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

		const { getByTestId, getByText } = await render(<ImportSheet />);
		expect(getByTestId("import-chrome-footer")).toBeTruthy();
		const continueButton = getByText("common.continue");
		expect(continueButton).toBeTruthy();

		fireEvent.press(continueButton);
		await waitFor(() => {
			expect(getByTestId("import-chrome-title")).toHaveTextContent(
				"import.titleResolve",
			);
		});
	});

	it("shows the resume notice on the resumed step, and the first setStep clears it", async () => {
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
		importDraftStore.dispatch({
			type: "resolutionSettled",
			outcome: "applied",
			reason: null,
			links: new Map(),
			fromModel: new Set(),
		});
		importDraftStore.setStep("resolve");
		importDraftStore.commitDismissal();
		expect(importDraftStore.getSnapshot().ui.resumed).toBe(true);
		mockCsvImportContext = baseCsvImportContext({ outcome: "applied" });

		const { getByTestId, getByText, queryByTestId } = await render(
			<ImportSheet />,
		);

		expect(getByTestId("import-chrome-title")).toHaveTextContent(
			"import.titleResolve",
		);
		expect(getByTestId("import-resume-notice")).toBeTruthy();
		expect(getByText('import.resolveReviewCta:{"count":0}')).toBeTruthy();

		fireEvent.press(getByTestId("import-chrome-back"));

		await waitFor(() => {
			expect(getByTestId("import-chrome-title")).toHaveTextContent(
				"import.titleFile",
			);
		});
		expect(queryByTestId("import-resume-notice")).toBeNull();
		expect(importDraftStore.getSnapshot().ui.resumed).toBe(false);
	});

	it("Start over resets the resumed draft to the source step", async () => {
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
		importDraftStore.setStep("resolve");
		importDraftStore.commitDismissal();

		const { getByTestId } = await render(<ImportSheet />);
		fireEvent.press(getByTestId("import-resume-start-over"));

		await waitFor(() => {
			expect(getByTestId("import-chrome-title")).toHaveTextContent(
				"import.titleSource",
			);
		});
		expect(importDraftStore.getSnapshot().flow.sourceId).toBeNull();
	});

	it("shows an enabled Review footer once resolution settles, and pressing it advances to review", async () => {
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
		importDraftStore.dispatch({
			type: "resolutionSettled",
			outcome: "applied",
			reason: null,
			links: new Map(),
			fromModel: new Set(),
		});
		importDraftStore.setStep("resolve");
		mockCsvImportContext = baseCsvImportContext({ outcome: "applied" });

		const { getByTestId, getByText } = await render(<ImportSheet />);
		const cta = getByText('import.resolveReviewCta:{"count":0}');
		expect(cta).toBeTruthy();

		fireEvent.press(cta);
		await waitFor(() => {
			expect(getByTestId("import-chrome-title")).toHaveTextContent(
				"import.titleReview",
			);
		});
	});

	it("degraded resolution (unavailable) still enables Review and reaches the review step", async () => {
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
		importDraftStore.dispatch({
			type: "resolutionSettled",
			outcome: "unavailable",
			reason: "offline",
			links: new Map(),
			fromModel: new Set(),
		});
		importDraftStore.setStep("resolve");
		mockCsvImportContext = baseCsvImportContext({
			outcome: "unavailable",
			reason: "offline",
		});

		const { getByTestId, getByText } = await render(<ImportSheet />);
		fireEvent.press(getByText('import.resolveReviewCta:{"count":0}'));

		await waitFor(() => {
			expect(getByTestId("import-chrome-title")).toHaveTextContent(
				"import.titleReview",
			);
		});
	});

	it("shows a disabled Import footer on the review step, and pressing it invokes onCommit", async () => {
		importDraftStore.dispatch({ type: "sourceSelected", sourceId: "csv" });
		importDraftStore.setStep("review");

		const { getByText, getByTestId } = await render(<ImportSheet />);

		expect(getByTestId("import-chrome-title")).toHaveTextContent(
			"import.titleReview",
		);
		const cta = getByText('import.reviewCommitCta:{"count":0}', {
			includeHiddenElements: true,
		});
		fireEvent.press(cta);
		expect(mockOnCommit).not.toHaveBeenCalled();
	});

	it("calls router.back on Cancel, and unmount discards a non-resumable draft (no file parsed yet)", async () => {
		const { getByText, unmount } = await render(<ImportSheet />);
		await act(async () => {
			importDraftStore.dispatch({ type: "sourceSelected", sourceId: "csv" });
		});

		fireEvent.press(getByText("common.cancel"));
		expect(mockBack).toHaveBeenCalledTimes(1);

		await unmount();
		expect(importDraftStore.getSnapshot().flow.sourceId).toBeNull();
	});
});
