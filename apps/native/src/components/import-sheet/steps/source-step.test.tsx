import { fireEvent, render } from "@testing-library/react-native";
import { SourceStep } from "./source-step";

const mockPush = jest.fn();
const mockDismissAll = jest.fn();
const mockDispatch = jest.fn();

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
jest.mock("@/contexts/import-flow-context", () => ({
	useImportFlow: () => ({ state: null, dispatch: mockDispatch }),
}));
jest.mock("@/domain/import-sources", () => ({
	IMPORT_SOURCES: [
		{
			id: "csv",
			titleKey: "settings.import.sourceCsvTitle",
			subtitleKey: "settings.import.sourceCsvSubtitle",
			icon: [],
			available: true,
			entryRoute: "/import/file",
		},
		{
			id: "ofx",
			titleKey: "settings.import.sourceCsvTitle",
			subtitleKey: "settings.import.sourceCsvSubtitle",
			icon: [],
			available: false,
			entryRoute: "/import/file",
		},
	],
}));

describe("SourceStep", () => {
	beforeEach(() => {
		mockPush.mockClear();
		mockDismissAll.mockClear();
		mockDispatch.mockClear();
	});

	it("renders every registry row", async () => {
		const { getAllByRole } = await render(<SourceStep />);
		const rows = getAllByRole("button", {
			name: /settings.import.sourceCsvTitle/,
		});
		expect(rows).toHaveLength(2);
	});

	it("renders an unavailable entry disabled, with no chevron and a Coming soon subtitle", async () => {
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
		expect(mockPush).not.toHaveBeenCalled();
		expect(mockDispatch).not.toHaveBeenCalled();
	});

	it("advances when the available CSV row is tapped", async () => {
		const { getAllByRole } = await render(<SourceStep />);
		const rows = getAllByRole("button", {
			name: /settings.import.sourceCsvTitle/,
		});
		fireEvent.press(rows[0]);

		expect(mockDispatch).toHaveBeenCalledWith({
			type: "sourceSelected",
			sourceId: "csv",
		});
		expect(mockPush).toHaveBeenCalledWith("/import/file");
	});

	it("pushes /settings/import and dismisses the sheet from Map columns manually", async () => {
		const { getByText } = await render(<SourceStep />);
		fireEvent.press(getByText("import.mapManually"));

		expect(mockPush).toHaveBeenCalledWith("/settings/import");
		expect(mockDismissAll).toHaveBeenCalled();
	});
});
