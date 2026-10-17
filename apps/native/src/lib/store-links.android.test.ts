import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { Linking } from "react-native";

import { takeHandoff } from "./app-handoff";
import { openStoreReview } from "./store-links";

describe("openStoreReview on Android", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("falls back to the web listing when nothing takes market://", async () => {
        const openURL = jest
            .spyOn(Linking, "openURL")
            .mockRejectedValueOnce(new Error("No Activity found to handle Intent"))
            .mockResolvedValue(undefined);

        await openStoreReview();

        expect(openURL).toHaveBeenLastCalledWith("https://play.google.com/store/apps/details?id=com.tryoutlayr.app");
    });

    it("announces the trip to the app lock", async () => {
        jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

        await openStoreReview();

        expect(takeHandoff()).toBe(true);
    });
});
