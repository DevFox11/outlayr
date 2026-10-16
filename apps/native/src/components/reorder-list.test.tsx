import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import type { MaterialRoleColors } from "@/theme/material-roles";

import { ReorderList } from "./reorder-list";

jest.mock<Partial<typeof import("@/i18n/context")>>("@/i18n/context", () => ({
    useTranslation: () => (key: string) => key,
}));
jest.mock<Partial<typeof import("@/lib/use-haptics")>>("@/lib/use-haptics", () => ({
    useHaptics: () => jest.fn(),
}));
jest.mock<Partial<typeof import("@/theme/use-material-colors")>>("@/theme/use-material-colors", () => ({
    useMaterialColors: () => ({ onSurfaceVariant: "#444444" }) as MaterialRoleColors,
}));

const ACCOUNTS = [
    { id: "chase", name: "Chase" },
    { id: "cash", name: "Cash" },
    { id: "ally", name: "Ally" },
] as const;

async function renderList(onReorder: (keys: string[]) => Promise<void>) {
    return await render(
        <ReorderList
            items={ACCOUNTS}
            keyOf={(account) => account.id}
            labelOf={(account) => account.name}
            onReorder={onReorder}
            renderItem={(account) => <Text>{account.name}</Text>}
        />,
        { wrapper: GestureHandlerRootView }
    );
}

describe("reorderList", () => {
    it("moves a row one slot with TalkBack's move actions", async () => {
        const onReorder = jest.fn<(keys: string[]) => Promise<void>>().mockResolvedValue();
        await renderList(onReorder);

        await fireEvent(screen.getByLabelText("Chase"), "accessibilityAction", {
            nativeEvent: { actionName: "moveDown" },
        });
        expect(onReorder).toHaveBeenLastCalledWith(["cash", "chase", "ally"]);

        await fireEvent(screen.getByLabelText("Ally"), "accessibilityAction", {
            nativeEvent: { actionName: "moveUp" },
        });
        expect(onReorder).toHaveBeenLastCalledWith(["chase", "ally", "cash"]);
    });

    it("offers no move past either end of the list", async () => {
        await renderList(jest.fn<(keys: string[]) => Promise<void>>().mockResolvedValue());

        const names = (label: string) =>
            screen.getByLabelText(label).props.accessibilityActions.map((action: { name: string }) => action.name);
        expect(names("Chase")).toStrictEqual(["moveDown"]);
        expect(names("Cash")).toStrictEqual(["moveUp", "moveDown"]);
        expect(names("Ally")).toStrictEqual(["moveUp"]);
    });
});
