import { fireEvent, render } from "@testing-library/react-native";
import { SourceStep } from "./source-step";

const mockDispatch = jest.fn();
const mockSetStep = jest.fn();

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string, params?: Record<string, unknown>) =>
		params ? `${key}:${JSON.stringify(params)}` : key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		foreground: "#17150F",
		muted: "#8A8578",
	}),
}));
jest.mock("@/lib/import-draft-store", () => ({
	importDraftStore: {
		dispatch: (...args: unknown[]) => mockDispatch(...args),
		setStep: (...args: unknown[]) => mockSetStep(...args),
	},
}));
jest.mock("@/domain/import-sources", () => ({
	IMPORT_SOURCES: [
		{
			id: "csv",
			titleKey: "settings.import.sourceCsvTitle",
			subtitleKey: "settings.import.sourceCsvSubtitle",
			icon: [],
			available: true,
		},
		{
			id: "clipboard",
			titleKey: "settings.import.sourceClipboardTitle",
			subtitleKey: "settings.import.sourceClipboardSubtitle",
			icon: [],
			available: false,
		},
	],
}));

describe("SourceStep", () => {
	beforeEach(() => {
		mockDispatch.mockClear();
		mockSetStep.mockClear();
	});

	it("renders the eyebrow with the available-source count", async () => {
		const { getByText } = await render(<SourceStep />);
		expect(getByText("import.sourceEyebrow")).toBeTruthy();
		expect(getByText('import.sourceCount:{"count":1,"total":2}')).toBeTruthy();
	});

	it("selects the source and advances to the file step on tap", async () => {
		const { getByTestId } = await render(<SourceStep />);

		fireEvent.press(getByTestId("import-source-csv"));

		expect(mockDispatch).toHaveBeenCalledWith({
			type: "sourceSelected",
			sourceId: "csv",
		});
		expect(mockSetStep).toHaveBeenCalledWith("file");
	});

	it("renders an unavailable source dimmed with a coming-soon subtitle and no advance", async () => {
		const { getByTestId, getByText } = await render(<SourceStep />);

		expect(getByText("import.sourceComingSoon")).toBeTruthy();
		fireEvent.press(getByTestId("import-source-clipboard"));
		expect(mockDispatch).not.toHaveBeenCalled();
		expect(mockSetStep).not.toHaveBeenCalled();
	});

	it("renders the device-privacy footnote", async () => {
		const { getByText } = await render(<SourceStep />);
		expect(getByText("import.sourceLede")).toBeTruthy();
	});
});
