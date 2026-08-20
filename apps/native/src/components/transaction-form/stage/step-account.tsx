import { ScrollView } from "react-native";

import { CategoryIconTile } from "@/components/category-icon-tile";
import { Text } from "@/components/text";
import type { Account } from "@/data/accounts-core";
import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

import { StageOptionRow } from "./stage-options";
import type { StageOptionItem } from "./stage-options";

/** Four rows of pills — see `step-category.tsx` for why the step scrolls rather than grows. */
const MAX_LIST_HEIGHT = 176;

const TILE = 22;

/** No account id can collide: they are uuids. */
const NONE_OPTION = "__none__";

interface StepAccountProps {
    accounts: readonly Account[];
    /** Offers "None" first: an entry is allowed to sit outside every account. */
    allowNone?: boolean;
    onSelect: (account: Account | null) => void;
    selectedId: string | null;
}

/**
 * The stage's account step: one option per account, or a sentence when there are
 * none. Creating one is deliberately not a prop: with nothing to pick, the way
 * out is the stage's own footer button, which the host points at its account
 * editor for as long as `accounts` is empty.
 */
export function StepAccount({ accounts, allowNone = true, onSelect, selectedId }: StepAccountProps) {
    const t = useTranslation();
    const colors = useColors();

    if (accounts.length === 0) {
        return (
            <Text className="text-muted text-subtitle" testID="stage-account-empty">
                {t("transaction.account.empty")}
            </Text>
        );
    }

    const options: StageOptionItem<string>[] = accounts.map((account) => ({
        id: account.id,
        label: account.name,
        leading: (
            <CategoryIconTile
                color={account.imageColor ?? account.customColor ?? colors.foreground}
                emoji={account.emoji}
                icon={account.icon}
                imageUri={account.imageUri}
                radius={6}
                size={TILE}
                type="solid"
            />
        ),
    }));
    if (allowNone) {
        options.unshift({ id: NONE_OPTION, label: t("transaction.account.none") });
    }

    const pick = (id: string) => {
        onSelect(accounts.find((account) => account.id === id) ?? null);
    };

    return (
        <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: MAX_LIST_HEIGHT }}
            testID="stage-accounts"
        >
            <StageOptionRow onSelect={pick} options={options} selectedId={selectedId ?? NONE_OPTION} />
        </ScrollView>
    );
}
