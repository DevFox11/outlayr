import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { InlineFailure } from "./inline-failure";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ danger: "#B5482F" }),
}));

describe("inlineFailure", () => {
    it("announces the message, which nothing else moves focus to", async () => {
        const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});

        await render(<InlineFailure message="Couldn't delete this account. Try again." />);

        expect(announce).toHaveBeenCalledWith("Couldn't delete this account. Try again.");
        announce.mockRestore();
    });
});
