import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthSessionProvider, sessionView, useAuthSession } from "./auth-session";

jest.mock("@/lib/auth-client", () => ({ authClient: null }));

function Probe() {
	const session = useAuthSession();
	return <Text testID="probe">{JSON.stringify(session)}</Text>;
}

describe("useAuthSession", () => {
	it("apple-session-quarantined-until-grant-stored", () => {
		expect(sessionView({ user: { id: "provisional-user" } }, false, true)).toEqual({
			accountId: null,
			gate: "restoring",
		});
	});
	it("resolves the unconfigured default via use() outside a provider", async () => {
		const { getByTestId } = await render(<Probe />);
		expect(getByTestId("probe").props.children).toBe(JSON.stringify({ accountId: null, gate: "unconfigured" }));
	});

	it("makes zero cloud calls when no runtime is configured", async () => {
		const { getByTestId } = await render(
			<AuthSessionProvider>
				<Probe />
			</AuthSessionProvider>
		);

		expect(getByTestId("probe").props.children).toBe(JSON.stringify({ accountId: null, gate: "unconfigured" }));
	});
});
