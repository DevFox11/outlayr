import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { ImportSheetChrome } from "./chrome";

jest.mock("@/i18n", () => ({
	useTranslation: () => (key: string) => key,
}));
jest.mock("@/theme/use-colors", () => ({
	useColors: () => ({
		foreground: "#17150F",
		muted: "#8A8578",
	}),
}));

describe("ImportSheetChrome", () => {
	it("shows the centred title for the active step", async () => {
		const { getByText } = await render(
			<ImportSheetChrome
				canGoBack={false}
				footer={null}
				onBack={jest.fn()}
				onCancel={jest.fn()}
				title="Import"
			>
				<Text>content</Text>
			</ImportSheetChrome>,
		);
		expect(getByText("Import")).toBeTruthy();
	});

	it("hides the back chevron when the nested stack is not poppable", async () => {
		const { queryByTestId } = await render(
			<ImportSheetChrome
				canGoBack={false}
				footer={null}
				onBack={jest.fn()}
				onCancel={jest.fn()}
				title="Import"
			>
				<Text>content</Text>
			</ImportSheetChrome>,
		);
		expect(queryByTestId("import-chrome-back")).toBeNull();
	});

	it("shows the back chevron and calls onBack when the nested stack is poppable", async () => {
		const onBack = jest.fn();
		const { getByTestId } = await render(
			<ImportSheetChrome
				canGoBack={true}
				footer={null}
				onBack={onBack}
				onCancel={jest.fn()}
				title="Choose a file"
			>
				<Text>content</Text>
			</ImportSheetChrome>,
		);
		fireEvent.press(getByTestId("import-chrome-back"));
		expect(onBack).toHaveBeenCalled();
	});

	it("keeps the title from intercepting the back chevron's touches", async () => {
		const { getByTestId } = await render(
			<ImportSheetChrome
				canGoBack={true}
				footer={null}
				onBack={jest.fn()}
				onCancel={jest.fn()}
				title="Choose a file"
			>
				<Text>content</Text>
			</ImportSheetChrome>,
		);
		expect(getByTestId("import-chrome-title").props.pointerEvents).toBe("none");
	});

	it("renders no footer when footer is null", async () => {
		const { queryByText } = await render(
			<ImportSheetChrome
				canGoBack={false}
				footer={null}
				onBack={jest.fn()}
				onCancel={jest.fn()}
				title="Import"
			>
				<Text>content</Text>
			</ImportSheetChrome>,
		);
		expect(queryByText("Continue")).toBeNull();
	});

	it("disables the footer CTA per prop and does not call onPress while disabled", async () => {
		const onPress = jest.fn();
		const { getByText } = await render(
			<ImportSheetChrome
				canGoBack={false}
				footer={{ label: "Continue", onPress, disabled: true }}
				onBack={jest.fn()}
				onCancel={jest.fn()}
				title="Choose a file"
			>
				<Text>content</Text>
			</ImportSheetChrome>,
		);
		fireEvent.press(getByText("Continue"));
		expect(onPress).not.toHaveBeenCalled();
	});

	it("enables the footer CTA per prop and calls onPress when tapped", async () => {
		const onPress = jest.fn();
		const { getByText } = await render(
			<ImportSheetChrome
				canGoBack={false}
				footer={{ label: "Continue", onPress, disabled: false }}
				onBack={jest.fn()}
				onCancel={jest.fn()}
				title="Choose a file"
			>
				<Text>content</Text>
			</ImportSheetChrome>,
		);
		fireEvent.press(getByText("Continue"));
		expect(onPress).toHaveBeenCalled();
	});

	it("renders a hairline rule below the header", async () => {
		const { getByTestId } = await render(
			<ImportSheetChrome
				canGoBack={false}
				footer={null}
				onBack={jest.fn()}
				onCancel={jest.fn()}
				title="Import"
			>
				<Text>content</Text>
			</ImportSheetChrome>,
		);
		expect(getByTestId("import-chrome-hairline")).toBeTruthy();
	});

	it("calls onCancel when Cancel is tapped", async () => {
		const onCancel = jest.fn();
		const { getByText } = await render(
			<ImportSheetChrome
				canGoBack={false}
				footer={null}
				onBack={jest.fn()}
				onCancel={onCancel}
				title="Import"
			>
				<Text>content</Text>
			</ImportSheetChrome>,
		);
		fireEvent.press(getByText("common.cancel"));
		expect(onCancel).toHaveBeenCalled();
	});
});
