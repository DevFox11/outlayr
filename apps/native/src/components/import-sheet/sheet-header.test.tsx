import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { SheetHeader } from "./sheet-header";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ foreground: "#17150F", muted: "#8A8578" }),
}));

describe("sheetHeader", () => {
    it("centers the title in a full-width overlay that never eats taps", async () => {
        const { getByTestId } = await render(<SheetHeader onBack={jest.fn()} onClose={jest.fn()} title="Review" />);
        expect(getByTestId("import-sheet-title").props.pointerEvents).toBe("none");
    });
});
