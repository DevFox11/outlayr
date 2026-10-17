import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthSessionProvider, sessionView, useAuthSession } from "./auth-session";

jest.mock<Partial<typeof import("@/lib/auth-client")>>("@/lib/auth-client", () => ({ authClient: null }));

const PROVISIONAL_USER = { email: "provisional@example.com", id: "provisional-user", name: "Provisional" };

function Probe() {
    const session = useAuthSession();
    return <Text testID="probe">{JSON.stringify(session)}</Text>;
}

describe("useAuthSession", () => {
    it("apple-session-quarantined-until-grant-stored", () => {
        expect(sessionView({ user: PROVISIONAL_USER }, false, true)).toStrictEqual({
            accountId: null,
            gate: "restoring",
            profile: null,
        });
    });

    it("keeps the quarantine cover up after the cold-start restore budget has lapsed", () => {
        expect(sessionView({ user: PROVISIONAL_USER }, false, true, true).gate).toBe("restoring");
    });

    it("makes zero cloud calls when no runtime is configured", async () => {
        const { getByTestId } = await render(
            <AuthSessionProvider>
                <Probe />
            </AuthSessionProvider>
        );

        expect(getByTestId("probe").props.children).toBe(
            JSON.stringify({ accountId: null, gate: "unconfigured", profile: null })
        );
    });
});
