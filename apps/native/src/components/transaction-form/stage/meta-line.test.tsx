import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { MetaLine } from "./meta-line";

describe("metaLine", () => {
    it("interrupts for the urgent tones only", async () => {
        const view = await render(<MetaLine statement="Rate is stale" tone="danger" />);
        expect(screen.getByText("Rate is stale").parent?.parent?.props.accessibilityRole).toBe("alert");

        await view.rerender(<MetaLine statement="Converted at today's rate" tone="info" />);
        expect(screen.getByText("Converted at today's rate").parent?.parent?.props.accessibilityRole).toBeUndefined();
    });
});
