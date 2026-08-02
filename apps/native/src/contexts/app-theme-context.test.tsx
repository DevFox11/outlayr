import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { AppThemeProvider, useAppTheme } from "./app-theme-context";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

function Probe() {
	const { isHydrated, currentTheme } = useAppTheme();
	return <Text testID="probe">{`${isHydrated}:${currentTheme}`}</Text>;
}

describe("useAppTheme", () => {
	it("resolves via use() inside AppThemeProvider and hydrates", async () => {
		const { getByTestId } = await render(
			<AppThemeProvider>
				<Probe />
			</AppThemeProvider>,
		);
		await waitFor(() =>
			expect(getByTestId("probe").props.children).toMatch(/^true:/),
		);
	});
});
