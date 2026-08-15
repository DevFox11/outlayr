import { describe, expect, it, jest } from "@jest/globals";
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
        useLiveQuery: (table: unknown) => (table === schema.transfers ? transferRows : feeRows),
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

const transferRows = [
    {
        exchangeRate: 1,
        exchangeRateType: null,
        fromAccountId: "from",
        fromAmount: 5000,
        fromCurrency: "USD",
        id: "transfer-1",
        toAccountId: "to",
        toAmount: 5000,
        toCurrency: "USD",
    },
];
const feeRows: unknown[] = [];

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
