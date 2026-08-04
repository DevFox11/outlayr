import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
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
jest.mock("@/contexts/csv-import-context", () => ({
	CsvImportProvider: ({ children }: { children: React.ReactNode }) => children,
	useCsvImportContext: () => ({
		running: false,
		outcome: null,
		reason: null,
		links: new Map(),
		fromModel: new Set(),
		totalLabels: 0,
		tier1Matched: 0,
		tier2Sent: 0,
		run: jest.fn(),
	}),
}));

describe("ImportSheet", () => {
	beforeEach(() => {
		mockBack.mockClear();
		mockPush.mockClear();
		mockDismissAll.mockClear();
		importDraftStore.clear();
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

	it("calls router.back on Cancel, and unmount unconditionally clears the draft (discard-only in this slice)", async () => {
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
