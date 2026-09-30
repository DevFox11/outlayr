import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { testColors as mockTestColors } from "@/theme/test-colors";

import { CurrencyRow } from "./currency-picker-row";

jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => ({
    __esModule: true,
    default: ({ children }: { children: ReactNode }) => children,
}));
jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useTranslation: () => (key: string) => key,
}));
jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));
jest.mock<Partial<typeof import("@/lib/use-haptics")>>("@/lib/use-haptics", () => ({
    useHaptics: () => jest.fn(),
}));

async function renderRow(code: "AED" | "USD"): Promise<void> {
    await render(
        <CurrencyRow
            code={code}
            favourite={false}
            full={false}
            last={false}
            onPress={jest.fn()}
            onToggleFavourite={null}
            selected={false}
            travelling={false}
        />
    );
}

describe("currencyRow", () => {
    it("states the code once when the symbol repeats it", async () => {
        await renderRow("AED");

        expect(screen.getByLabelText("AED, United Arab Emirates Dirham")).toBeTruthy();
    });
});
