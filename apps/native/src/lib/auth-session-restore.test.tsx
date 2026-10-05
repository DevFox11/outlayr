import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { AuthSessionProvider, useAuthSession } from "./auth-session";

const mockCookie = { current: "" };

jest.mock<Partial<typeof import("@/lib/auth-client")>>("@/lib/auth-client", () => ({
    authClient: {
        getCookie: () => mockCookie.current,
    } as never,
    useAuthClientSession: (() => ({ data: null, isPending: true })) as never,
}));

function Gate() {
    return <Text testID="gate">{useAuthSession().gate}</Text>;
}

async function gateWithCookie(cookie: string) {
    mockCookie.current = cookie;
    const { getByTestId } = await render(
        <AuthSessionProvider>
            <Gate />
        </AuthSessionProvider>
    );
    return getByTestId("gate").props.children;
}

describe("session restore", () => {
    it("settles signed out at once when no cookie is stored", async () => {
        await expect(gateWithCookie("")).resolves.toBe("signed-out");
    });

    it("waits on the read when a cookie is stored", async () => {
        await expect(gateWithCookie("better-auth.session_token=abc")).resolves.toBe("restoring");
    });
});
