import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";

import { appleCredential } from "@/lib/apple-sign-in";
import { googleIdToken } from "@/lib/google-sign-in";

import { ProviderSignInButtons } from "./provider-sign-in-buttons";

jest.mock<Partial<typeof import("@/lib/apple-sign-in")>>("@/lib/apple-sign-in", () => ({
    appleCredential: jest.fn<typeof import("@/lib/apple-sign-in").appleCredential>(),
}));

jest.mock<Partial<typeof import("@/lib/google-sign-in")>>("@/lib/google-sign-in", () => ({
    googleIdToken: jest.fn<typeof import("@/lib/google-sign-in").googleIdToken>(),
    isGoogleSignInAvailable: true,
}));

interface ButtonProps {
    disabled: boolean;
    onPress: () => void;
    pending: boolean;
}

jest.mock<Partial<typeof import("@/components/account/apple-sign-in-button")>>(
    "@/components/account/apple-sign-in-button",
    () => {
        const { Pressable, Text } = require("react-native");
        return {
            AppleSignInButton: ({ disabled, onPress, pending }: ButtonProps) => (
                <Pressable
                    accessibilityState={{ busy: pending, disabled }}
                    onPress={onPress}
                    testID="apple-sign-in-button"
                >
                    <Text>apple</Text>
                </Pressable>
            ),
        };
    }
);

jest.mock<Partial<typeof import("@/components/account/google-sign-in-button")>>(
    "@/components/account/google-sign-in-button",
    () => {
        const { Pressable, Text } = require("react-native");
        return {
            GoogleSignInButton: ({ disabled, onPress, pending }: ButtonProps) => (
                <Pressable
                    accessibilityState={{ busy: pending, disabled }}
                    onPress={onPress}
                    testID="google-sign-in-button"
                >
                    <Text>google</Text>
                </Pressable>
            ),
        };
    }
);

const googleSignInMock = jest.requireMock("@/lib/google-sign-in") as {
    isGoogleSignInAvailable: boolean;
};

describe("providerSignInButtons availability", () => {
    const originalPlatform = Platform.OS;

    afterEach(() => {
        Platform.OS = originalPlatform;
        googleSignInMock.isGoogleSignInAvailable = true;
    });

    it("renders only Apple when Google is unavailable", async () => {
        Platform.OS = "ios";
        googleSignInMock.isGoogleSignInAvailable = false;
        const { queryByTestId } = await render(
            <ProviderSignInButtons busy={null} fallbackClassName="fallback" start={jest.fn()} />
        );
        expect(queryByTestId("apple-sign-in-button")).not.toBeNull();
        expect(queryByTestId("google-sign-in-button")).toBeNull();
    });

    it("renders only Google when Apple is unavailable", async () => {
        Platform.OS = "android";
        googleSignInMock.isGoogleSignInAvailable = true;
        const { queryByTestId } = await render(
            <ProviderSignInButtons busy={null} fallbackClassName="fallback" start={jest.fn()} />
        );
        expect(queryByTestId("apple-sign-in-button")).toBeNull();
        expect(queryByTestId("google-sign-in-button")).not.toBeNull();
    });

    it("renders both when both are available", async () => {
        Platform.OS = "ios";
        googleSignInMock.isGoogleSignInAvailable = true;
        const { queryByTestId } = await render(
            <ProviderSignInButtons busy={null} fallbackClassName="fallback" start={jest.fn()} />
        );
        expect(queryByTestId("apple-sign-in-button")).not.toBeNull();
        expect(queryByTestId("google-sign-in-button")).not.toBeNull();
    });

    it("shows the noProvider fallback styled with the caller class when neither is available", async () => {
        Platform.OS = "android";
        googleSignInMock.isGoogleSignInAvailable = false;
        const { queryByTestId, getByText } = await render(
            <ProviderSignInButtons
                busy={null}
                fallbackClassName="text-fr-muted text-subtitle leading-snug"
                start={jest.fn()}
            />
        );
        expect(queryByTestId("apple-sign-in-button")).toBeNull();
        expect(queryByTestId("google-sign-in-button")).toBeNull();
        const fallback = getByText("settings.account.noProvider");
        expect(fallback.props.className).toBe("text-fr-muted text-subtitle leading-snug");
    });
});

describe("providerSignInButtons busy state", () => {
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        Platform.OS = "ios";
        googleSignInMock.isGoogleSignInAvailable = true;
    });

    afterEach(() => {
        Platform.OS = originalPlatform;
    });

    it("shows neither control as pending or disabled while idle", async () => {
        const { getByTestId } = await render(
            <ProviderSignInButtons busy={null} fallbackClassName="fallback" start={jest.fn()} />
        );
        expect(getByTestId("apple-sign-in-button").props.accessibilityState).toMatchObject({
            busy: false,
            disabled: false,
        });
        expect(getByTestId("google-sign-in-button").props.accessibilityState).toMatchObject({
            busy: false,
            disabled: false,
        });
    });

    it("marks Apple pending and Google disabled while Apple is busy", async () => {
        const { getByTestId } = await render(
            <ProviderSignInButtons busy="apple" fallbackClassName="fallback" start={jest.fn()} />
        );
        expect(getByTestId("apple-sign-in-button").props.accessibilityState).toMatchObject({
            busy: true,
            disabled: true,
        });
        expect(getByTestId("google-sign-in-button").props.accessibilityState).toMatchObject({
            busy: false,
            disabled: true,
        });
    });
});

describe("providerSignInButtons start wiring", () => {
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        Platform.OS = "ios";
        googleSignInMock.isGoogleSignInAvailable = true;
    });

    afterEach(() => {
        Platform.OS = originalPlatform;
    });

    it("starts Apple with the apple id token getter", async () => {
        const start = jest.fn();
        const { getByTestId } = await render(
            <ProviderSignInButtons busy={null} fallbackClassName="fallback" start={start} />
        );
        fireEvent.press(getByTestId("apple-sign-in-button"));
        expect(start).toHaveBeenCalledWith({ getCredential: appleCredential, provider: "apple" });
    });

    it("starts Google with the google id token getter", async () => {
        const start = jest.fn();
        const { getByTestId } = await render(
            <ProviderSignInButtons busy={null} fallbackClassName="fallback" start={start} />
        );
        fireEvent.press(getByTestId("google-sign-in-button"));
        expect(start).toHaveBeenCalledWith({ getCredential: googleIdToken, provider: "google" });
    });
});
