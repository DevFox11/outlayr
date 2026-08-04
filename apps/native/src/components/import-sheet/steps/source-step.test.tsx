import { fireEvent, render } from "@testing-library/react-native";
import { SourceStep } from "./source-step";

const mockDispatch = jest.fn();
const mockGoTo = jest.fn();

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

	it("dispatches sourceSelected and moves the cursor to file when the available CSV row is tapped", async () => {
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
	});

	it("renders no escape hatch to the deleted manual-mapping screen", async () => {
		const { queryByText } = await render(<SourceStep />);
		expect(queryByText("import.mapManually")).toBeNull();
	});
});
