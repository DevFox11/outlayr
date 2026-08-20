import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { MetaLine } from "./meta-line";

describe("metaLine", () => {
    it("renders the statement alone when nothing else is given", async () => {
        await render(<MetaLine statement="Rate is 3 days old" />);
        expect(screen.getByText("Rate is 3 days old")).toBeTruthy();
    });

    it("renders the right-hand qualifier", async () => {
        await render(<MetaLine qualifier="12 Aug" statement="Rate is 3 days old" />);
        expect(screen.getByText("12 Aug")).toBeTruthy();
    });

    it("renders the mono sub-line", async () => {
        await render(<MetaLine detail="1 USD = 36.62 VES" statement="Rate is 3 days old" />);
        expect(screen.getByText("1 USD = 36.62 VES").props.className).toContain("font-mono");
    });

    it("colours the statement by tone and leaves the qualifier muted", async () => {
        await render(<MetaLine qualifier="12 Aug" statement="Rate is stale" tone="danger" />);
        expect(screen.getByText("Rate is stale").props.className).toContain("text-danger");
        expect(screen.getByText("12 Aug").props.className).toContain("text-muted");
    });

    // `--warning` is a rail and chart fill at 1.51:1 on paper; the readable
    // token is its foreground pair, and token-contrast.test.ts enforces that.
    it("never writes the fill-only warning token", async () => {
        await render(<MetaLine statement="Split does not add up" tone="warning" />);
        expect(screen.getByText("Split does not add up").props.className).toContain("text-warning-foreground");
    });

    it("interrupts for the urgent tones only", async () => {
        const view = await render(<MetaLine statement="Rate is stale" tone="danger" />);
        expect(screen.getByText("Rate is stale").parent?.parent?.props.accessibilityRole).toBe("alert");

        await view.rerender(<MetaLine statement="Converted at today's rate" tone="info" />);
        expect(screen.getByText("Converted at today's rate").parent?.parent?.props.accessibilityRole).toBeUndefined();
    });
});
