import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import type { Account } from "@/data/accounts-core";
import { testColors as mockTestColors } from "@/theme/test-colors";

import { StepAccount } from "./step-account";

jest.mock<typeof import("@/theme/use-colors")>("@/theme/use-colors", () => ({
    useColors: () => mockTestColors(),
}));

const account = (id: string, name: string): Account => ({
    currency: "USD",
    customColor: null,
    dateCreated: new Date(0),
    deletedAt: null,
    emoji: null,
    icon: null,
    id,
    imageColor: null,
    imageKey: null,
    imageUri: null,
    initialBalance: 0,
    initialBalanceDate: new Date(0),
    initialBalanceUsd: 0,
    kind: "asset",
    name,
    sortOrder: 0,
    updatedAt: new Date(0),
});

const ACCOUNTS = [account("chase", "Chase"), account("cash", "Cash")];

const baseProps: ComponentProps<typeof StepAccount> = {
    accounts: ACCOUNTS,
    onSelect: jest.fn(),
    selectedId: null,
};

const optionNames = () => screen.getAllByRole("button").map((node) => node.props.accessibilityLabel);

describe("stepAccount", () => {
    it("offers none first, then each account", async () => {
        await render(<StepAccount {...baseProps} />);

        expect(optionNames()).toStrictEqual(["transaction.account.none", "Chase", "Cash"]);
    });

    it("drops none where the entry must sit somewhere", async () => {
        await render(<StepAccount {...baseProps} allowNone={false} />);

        expect(optionNames()).toStrictEqual(["Chase", "Cash"]);
    });

    it("marks the selected account", async () => {
        await render(<StepAccount {...baseProps} selectedId="cash" />);

        expect(screen.getByRole("button", { name: "Cash" }).props.accessibilityState.selected).toBe(true);
        expect(screen.getByRole("button", { name: "transaction.account.none" }).props.accessibilityState.selected).toBe(
            false
        );
    });

    it("marks none while the entry sits in no account", async () => {
        await render(<StepAccount {...baseProps} />);

        expect(screen.getByRole("button", { name: "transaction.account.none" }).props.accessibilityState.selected).toBe(
            true
        );
    });

    it("reports the account it was given", async () => {
        const onSelect = jest.fn();
        await render(<StepAccount {...baseProps} onSelect={onSelect} />);

        fireEvent.press(screen.getByRole("button", { name: "Chase" }));

        expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "chase" }));
    });

    // One press per test: two in the same one leave React mid-flush, and the next
    // test's `render` then resolves before its tree commits.
    it("reports none as no account at all", async () => {
        const onSelect = jest.fn();
        await render(<StepAccount {...baseProps} onSelect={onSelect} />);

        fireEvent.press(screen.getByRole("button", { name: "transaction.account.none" }));

        expect(onSelect).toHaveBeenCalledWith(null);
    });

    // Nothing to pick, so the step only states it — creating one is the stage's
    // own footer button, which the host repoints while the list is empty.
    it("states the empty case instead of an empty row", async () => {
        await render(<StepAccount {...baseProps} accounts={[]} />);

        expect(screen.getByTestId("stage-account-empty")).toBeTruthy();
        expect(screen.queryByTestId("stage-accounts")).toBeNull();
        expect(screen.queryByRole("button")).toBeNull();
    });
});
