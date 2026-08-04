import { fireEvent, render } from "@testing-library/react-native";
import { SourceStep } from "./source-step";

const mockPush = jest.fn();
const mockDismissAll = jest.fn();
const mockDispatch = jest.fn();
const mockGoTo = jest.fn();

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush, dismissAll: mockDismissAll }),
}));
jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		foreground: "#17150F",
		muted: "#8A8578",
		background: "#F2F0EA",
	}),
}));
jest.mock("@/components/wizard", () => ({
	useWizard: () => ({ goTo: mockGoTo }),
}));
jest.mock("@/lib/import-draft-store", () => ({
	importDraftStore: {
		dispatch: (...args: unknown[]) => mockDispatch(...args),
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
			id: "ofx",
			titleKey: "settings.import.sourceCsvTitle",
			subtitleKey: "settings.import.sourceCsvSubtitle",
			icon: [],
			available: false,
		},
	],
}));

describe("SourceStep", () => {
	beforeEach(() => {
		mockPush.mockClear();
		mockDismissAll.mockClear();
		mockDispatch.mockClear();
		mockGoTo.mockClear();
	});

	it("renders every registry row", async () => {
		const { getAllByRole } = await render(<SourceStep />);
		const rows = getAllByRole("button", {
			name: /settings.import.sourceCsvTitle/,
		});
		expect(rows).toHaveLength(2);
	});

	it("renders an unavailable entry disabled, with no chevron and a Coming soon subtitle, and tapping it moves nothing", async () => {
		const { getByText, getAllByRole } = await render(<SourceStep />);
		expect(getByText("import.sourceComingSoon")).toBeTruthy();

		const rows = getAllByRole("button", {
			name: /settings.import.sourceCsvTitle/,
		});
		const disabledRow = rows[1];
		expect(disabledRow.props.accessibilityState).toEqual(
			expect.objectContaining({ disabled: true }),
		);

		fireEvent.press(disabledRow);
		expect(mockDispatch).not.toHaveBeenCalled();
		expect(mockGoTo).not.toHaveBeenCalled();
	});

	it("dispatches sourceSelected and moves the cursor to file when the available CSV row is tapped, with no router push", async () => {
		const { getAllByRole } = await render(<SourceStep />);
		const rows = getAllByRole("button", {
			name: /settings.import.sourceCsvTitle/,
		});
		fireEvent.press(rows[0]);

		expect(mockDispatch).toHaveBeenCalledWith({
			type: "sourceSelected",
			sourceId: "csv",
		});
		expect(mockGoTo).toHaveBeenCalledWith("file");
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("pushes /settings/import and dismisses the sheet from Map columns manually", async () => {
		const { getByText } = await render(<SourceStep />);
		fireEvent.press(getByText("import.mapManually"));

		expect(mockPush).toHaveBeenCalledWith("/settings/import");
		expect(mockDismissAll).toHaveBeenCalled();
	});
});
