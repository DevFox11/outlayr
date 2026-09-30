import { describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";

import type { TransferSeed } from "@/components/transfer-editor/use-transfer-draft";

const mockParams = jest.fn<() => Record<string, string>>();
const mockEditor = jest.fn<(props: { seed: TransferSeed }) => null>(() => null);

jest.mock("expo-router", () => ({
    Stack: { Screen: { Title: () => null } },
    useLocalSearchParams: () => mockParams(),
    useRouter: () => ({ back: jest.fn() }),
}));
jest.mock("@/components/close-toolbar", () => ({ CloseToolbar: () => null }));
jest.mock("@/hooks/use-discard-guard", () => ({
    useDiscardGuard: () => ({ leave: jest.fn(), setDirty: jest.fn() }),
}));
jest.mock("@/components/transfer-editor", () => ({
    __esModule: true,
    default: (props: { seed: TransferSeed }) => mockEditor(props),
}));

import TransferCreateScreen from "@/app/transactions/transfers/create";

const seedFor = async (params: Record<string, string>) => {
    mockParams.mockReturnValue(params);
    await render(<TransferCreateScreen />);
    return mockEditor.mock.lastCall?.[0].seed;
};

describe("transferCreateScreen", () => {
    it("drops a currency the app does not know, and the amount given in it", async () => {
        await expect(seedFor({ amount: "50", currency: "VES" })).resolves.toMatchObject({
            amount: 50,
            currency: "VES",
        });
        await expect(seedFor({ amount: "50", currency: "nope" })).resolves.toMatchObject({
            amount: undefined,
            currency: undefined,
        });
    });

    it("drops an amount the keypad could not hold and a date no calendar has", async () => {
        await expect(seedFor({ amount: "50", date: "86400000" })).resolves.toMatchObject({
            amount: 50,
            date: new Date(86_400_000),
        });
        await expect(seedFor({ amount: "1e21", date: "1e20" })).resolves.toMatchObject({
            amount: undefined,
            date: undefined,
        });
    });
});
