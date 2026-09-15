import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render } from "@testing-library/react-native";

import { unusedDatabase as mockUnusedDatabase } from "@/db/test-database";
import { testColors as mockTestColors } from "@/theme/test-colors";

import TransferDetail from "./detail";

jest.mock("@/db/schema", () => ({
    transactions: { __table: "transactions" },
    transfers: { __table: "transfers" },
}));

jest.mock("@/data/live-query", () => {
    const schema = require("@/db/schema");
    return {
        useLiveQuery: (table: unknown) => (table === schema.transfers ? mockTransferRows : mockFeeRows),
    };
});

jest.mock<Partial<typeof import("@/contexts/local-data-context")>>("@/contexts/local-data-context", () => ({
    useDatabase: () => mockUnusedDatabase(),
}));

jest.mock("@/data/accounts", () => ({
    useAccounts: () => [
        { currency: "USD", id: "from", name: "Checking" },
        { currency: "USD", id: "to", name: "Savings" },
    ],
}));

jest.mock("@/data/use-deferred-delete", () => ({
    useDeferredDelete: () => ({ pendingId: null, requestDelete: jest.fn() }),
}));

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors({ danger: "#FF3B30" }),
}));

jest.mock("expo-router", () => ({
    useRouter: () => ({ back: jest.fn() }),
}));

const SAME_CURRENCY_TRANSFER = {
    exchangeRate: 1,
    exchangeRateType: null as string | null,
    fromAccountId: "from",
    fromAmount: 5000,
    fromCurrency: "USD",
    id: "transfer-1",
    toAccountId: "to",
    toAmount: 5000,
    toCurrency: "USD",
};
const mockTransferRows = [{ ...SAME_CURRENCY_TRANSFER }];

beforeEach(() => {
    mockTransferRows[0] = { ...SAME_CURRENCY_TRANSFER };
});

function allText(node: JsonNode | JsonNode[] | null, found: string[] = []): string[] {
    if (node == null) {
        return found;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            allText(child, found);
        }
        return found;
    }
    const text = node.props?.text;
    if (typeof text === "string") {
        found.push(text);
    }
    for (const child of node.children ?? []) {
        if (typeof child === "string") {
            found.push(child);
        } else {
            allText(child, found);
        }
    }
    return found;
}
const mockFeeRows: unknown[] = [];

interface Modifier {
    $type: string;
    children?: string;
    label?: string;
    traits?: string[];
}

interface JsonNode {
    children: (JsonNode | string)[] | null;
    props: Record<string, unknown>;
    type: string;
}

function findTappableRow(node: JsonNode | JsonNode[] | null): Modifier[] | null {
    if (node == null) {
        return null;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findTappableRow(child);
            if (found) {
                return found;
            }
        }
        return null;
    }
    const modifiers = node.props?.modifiers as Modifier[] | undefined;
    if (Array.isArray(modifiers) && modifiers.some((modifier) => modifier.$type === "onTapGesture")) {
        return modifiers;
    }
    for (const child of node.children ?? []) {
        if (typeof child !== "string") {
            const found = findTappableRow(child);
            if (found) {
                return found;
            }
        }
    }
    return null;
}

async function deleteRowModifiers(): Promise<Modifier[]> {
    const { toJSON } = await render(<TransferDetail id="transfer-1" />);
    const modifiers = findTappableRow(toJSON() as JsonNode);
    if (!modifiers) {
        throw new Error("no tappable row rendered");
    }
    return modifiers;
}

describe("transferDetail", () => {
    it("names the rate source through the catalog, not as the stored enum", async () => {
        mockTransferRows[0] = {
            ...SAME_CURRENCY_TRANSFER,
            exchangeRate: 0.92,
            exchangeRateType: "eur_reference",
            toCurrency: "EUR",
        };

        const { toJSON } = await render(<TransferDetail id="transfer-1" />);

        const text = allText(toJSON() as JsonNode);
        expect(text).toContain("transfers.rate.eur_reference");
        expect(text).not.toContain("eur_reference");
    });

    it("spells the rate the way every other rate readout does", async () => {
        mockTransferRows[0] = {
            ...SAME_CURRENCY_TRANSFER,
            exchangeRate: 36,
            exchangeRateType: "official",
            toCurrency: "VES",
        };

        const { toJSON } = await render(<TransferDetail id="transfer-1" />);

        expect(allText(toJSON() as JsonNode)).toContain("36");
    });

    it("announces its delete row as a button, since a tap gesture alone gives VoiceOver nothing to press", async () => {
        const modifiers = await deleteRowModifiers();

        expect(modifiers).toStrictEqual(
            expect.arrayContaining([expect.objectContaining({ $type: "accessibilityAddTraits", traits: ["isButton"] })])
        );
    });

    it("names its delete row with the same words it shows", async () => {
        const modifiers = await deleteRowModifiers();

        expect(modifiers).toStrictEqual(
            expect.arrayContaining([
                expect.objectContaining({ $type: "accessibilityLabel", label: "transfers.delete.row" }),
            ])
        );
    });

    it("merges the delete row into one element, so it is reached as a single control", async () => {
        const modifiers = await deleteRowModifiers();

        expect(modifiers).toStrictEqual(
            expect.arrayContaining([expect.objectContaining({ $type: "accessibilityElement", children: "combine" })])
        );
    });
});
