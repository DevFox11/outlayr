import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";

import { AccountTile } from "@/components/account-tile";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { useDatabase } from "@/contexts/local-data-context";
import type { Account } from "@/data/accounts-core";
import { useGlobalCurrency } from "@/data/app-meta";
import { useAccessibilityTextSize } from "@/hooks/use-accessibility-text-size";
import { useTranslation } from "@/i18n/context";

import { StageOptionRow } from "./stage-options";
import type { StageOptionItem } from "./stage-options";

/** Four rows of pills — see `step-category.tsx` for why the step scrolls rather than grows. */
const MAX_LIST_HEIGHT = 176;

const TILE = 22;

/** No account id can collide: they are uuids. */
const NONE_OPTION = "__none__";
const NO_PEOPLE: readonly Account[] = [];

interface StepAccountProps {
    accounts: readonly Account[];
    /** More options under the accounts and people. */
    after?: ReactNode;
    /** Offers "None" first: an entry is allowed to sit outside every account. */
    allowNone?: boolean;
    onSelect: (account: Account | null) => void;
    /** A section after the banks, for money that moved with a person. */
    people?: readonly Account[];
    selectedId: string | null;
}

/**
 * The stage's account step: one option per account, then the people, or a
 * sentence when there are neither. Creating one is deliberately not a prop:
 * with no bank to pick, the way out is the stage's own footer button, which the
 * host points at its account editor for as long as `accounts` is empty.
 */
export function StepAccount({
    accounts,
    after,
    allowNone = true,
    onSelect,
    people = NO_PEOPLE,
    selectedId,
}: StepAccountProps) {
    const t = useTranslation();
    const largeText = useAccessibilityTextSize();
    const ledgerCurrency = useGlobalCurrency(useDatabase());

    if (accounts.length === 0 && people.length === 0) {
        return (
            <>
                <Text className="text-muted text-subtitle" testID="stage-account-empty">
                    {t("transaction.account.empty")}
                </Text>
                {after}
            </>
        );
    }

    const optionFor = (account: Account): StageOptionItem<string> => {
        const foreign = account.currency !== ledgerCurrency;
        return {
            accessibilityLabel: foreign ? `${account.name}, ${account.currency}` : undefined,
            id: account.id,
            label: account.name,
            leading: <AccountTile account={account} radius={6} size={TILE} />,
            trailing: foreign ? <Text className="text-label text-tint font-mono">{account.currency}</Text> : undefined,
        };
    };
    const options = accounts.map(optionFor);
    if (allowNone) {
        options.unshift({ id: NONE_OPTION, label: t("transaction.account.none") });
    }

    const pick = (id: string) => {
        onSelect([...accounts, ...people].find((account) => account.id === id) ?? null);
    };

    return (
        <ScrollView
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!largeText}
            showsVerticalScrollIndicator={false}
            style={largeText ? undefined : { maxHeight: MAX_LIST_HEIGHT }}
            testID="stage-accounts"
        >
            {options.length > 0 ? (
                <StageOptionRow onSelect={pick} options={options} selectedId={selectedId ?? NONE_OPTION} />
            ) : null}
            {people.length > 0 ? (
                <View className="gap-2 pt-4">
                    <MonoLabel>{t("debts.people")}</MonoLabel>
                    <StageOptionRow onSelect={pick} options={people.map(optionFor)} selectedId={selectedId} />
                </View>
            ) : null}
            {after}
        </ScrollView>
    );
}
