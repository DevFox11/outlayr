import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { MonoLabel } from "@/components/mono-label";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { SettingsSection } from "./settings-row";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({}),
}));

describe("settingsSection", () => {
    it("announces its title as a heading, so the rotor can skip to it", async () => {
        await render(<SettingsSection title="Data" />);

        expect(screen.getByRole("header", { name: "Data" })).toBeOnTheScreen();
    });

    it("leaves a plain eyebrow without the role", async () => {
        await render(<MonoLabel>SPENT · THIS MONTH</MonoLabel>);

        expect(screen.queryByRole("header")).toBeNull();
    });
});
