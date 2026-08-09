import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { useAuthSession } from "./auth-session";

jest.mock("@/lib/auth-client", () => ({ authClient: null }));

function Probe() {
	const session = useAuthSession();
	return <Text testID="probe">{JSON.stringify(session)}</Text>;
}

describe("useAuthSession", () => {
	it("resolves the unconfigured default via use() outside a provider", async () => {
		const { getByTestId } = await render(<Probe />);
		expect(getByTestId("probe").props.children).toBe(JSON.stringify({ accountId: null, gate: "unconfigured" }));
	});
});
