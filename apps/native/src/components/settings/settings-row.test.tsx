import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { MonoLabel } from "@/components/mono-label";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { SettingsSection } from "./settings-row";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({}),
}));

describe("settingsSection", () => {
    // SettingsSection is the entire heading structure of Settings — 35 uses across
    // 13 screens. Without the role the VoiceOver rotor's Headings mode finds nothing
    // on any of them, and reaching "Data" means swiping every row of the six
    // sections above it.
    it("announces its title as a heading, so the rotor can skip to it", async () => {
        await render(<SettingsSection title="Data" />);

        expect(screen.getByRole("header", { name: "Data" })).toBeOnTheScreen();
    });

    // The same label also spells eyebrows like "SPENT · THIS MONTH", which are not
    // headings and must not be announced as ones.
    it("leaves a plain eyebrow without the role", async () => {
        await render(<MonoLabel>SPENT · THIS MONTH</MonoLabel>);

        expect(screen.queryByRole("header")).toBeNull();
    });
});
