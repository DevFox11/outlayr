import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { ghostInk } from "@/theme/empty-state-ink";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { MarkInk, useMark } from "./empty-state";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ foreground: "#000000" }),
}));

function Probe() {
    const ink = useMark();
    return <Text testID="probe">{ink.fill}</Text>;
}

describe("useMark", () => {
    // Naming the tier is the point: `ink.fill` is an rgba() string for every
    // tier, so a truthiness check let the default fall to any of the three.
    // Takeover is the loudest, and it is what a full-screen empty state wants.
    it("resolves via use() outside a MarkInk provider", async () => {
        const { getByTestId } = await render(<Probe />);
        expect(getByTestId("probe").props.children).toBe(ghostInk("#000000", "takeover").fill);
    });

    it("resolves the provided tier's ink via use() inside a MarkInk provider", async () => {
        const { getByTestId: outside } = await render(<Probe />);
        const { getByTestId: inside } = await render(
            <MarkInk tier="insetRow">
                <Probe />
            </MarkInk>
        );
        expect(inside("probe").props.children).not.toBe(outside("probe").props.children);
    });
});
