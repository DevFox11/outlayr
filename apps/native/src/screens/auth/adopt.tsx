import { useState } from "react";
import { Pressable, View } from "react-native";

import { FirstRun } from "@/components/first-run";
import { MonoLabel } from "@/components/mono-label";
import { Text } from "@/components/text";
import { ADOPTION_CHOICES, isDestructiveChoice } from "@/domain/ledger-adoption";
import type { AdoptionChoice } from "@/domain/ledger-adoption";
import type { TranslationKey } from "@/i18n/catalog";
import { useTranslation } from "@/i18n/context";
import { useLedgerAdoption } from "@/lib/ledger-adoption";

const COPY = {
    "keep-account": {
        body: "auth.adopt.keepAccount.body",
        confirm: "auth.adopt.confirm.keepAccount",
        title: "auth.adopt.keepAccount.title",
    },
    "keep-local": {
        body: "auth.adopt.keepLocal.body",
        confirm: "auth.adopt.confirm.keepLocal",
        title: "auth.adopt.keepLocal.title",
    },
    merge: {
        body: "auth.adopt.merge.body",
        confirm: "auth.adopt.merge.body",
        title: "auth.adopt.merge.title",
    },
} satisfies Record<AdoptionChoice, { title: TranslationKey; body: TranslationKey; confirm: TranslationKey }>;

export function LedgerAdoption() {
    const { status, failed, choose } = useLedgerAdoption();
    const [confirming, setConfirming] = useState<AdoptionChoice | null>(null);
    const t = useTranslation();
    const working = status === "working";

    if (confirming) {
        return (
            <FirstRun
                body={t(COPY[confirming].confirm)}
                eyebrow={t("auth.adopt.eyebrow")}
                title={t("auth.adopt.confirm.title")}
            >
                <View className="gap-3">
                    <Pressable
                        accessibilityRole="button"
                        className="bg-accent items-center rounded-full px-7 py-3.5 active:opacity-80 disabled:opacity-50"
                        disabled={working}
                        onPress={() => {
                            setConfirming(null);
                            choose("merge");
                        }}
                    >
                        <Text className="font-sans-semibold text-accent-foreground text-body">
                            {t("auth.adopt.confirm.cancel")}
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        className="border-danger items-center rounded-full border px-7 py-3.5 active:opacity-80 disabled:opacity-50"
                        disabled={working}
                        onPress={() => {
                            const choice = confirming;
                            setConfirming(null);
                            choose(choice);
                        }}
                    >
                        <Text className="font-sans-semibold text-body text-danger">
                            {t("auth.adopt.confirm.proceed")}
                        </Text>
                    </Pressable>
                </View>
            </FirstRun>
        );
    }

    return (
        <FirstRun body={t("auth.adopt.body")} eyebrow={t("auth.adopt.eyebrow")} title={t("auth.adopt.title")}>
            <View className="border-border border-t">
                {ADOPTION_CHOICES.map((choice, index) => (
                    <Pressable
                        accessibilityRole="button"
                        className="border-border flex-row gap-4 border-b py-5 active:opacity-60 disabled:opacity-50"
                        disabled={working}
                        key={choice}
                        onPress={() => {
                            if (isDestructiveChoice(choice)) {
                                setConfirming(choice);
                                return;
                            }
                            choose(choice);
                        }}
                    >
                        <MonoLabel className="w-6 pt-1">{String(index + 1).padStart(2, "0")}</MonoLabel>
                        <View className="flex-1 gap-1">
                            <Text className="font-sans-semibold text-callout text-foreground">
                                {t(COPY[choice].title)}
                            </Text>
                            <Text className="text-muted text-subtitle leading-snug">{t(COPY[choice].body)}</Text>
                        </View>
                    </Pressable>
                ))}
            </View>

            {working ? (
                <Text className="text-muted text-subtitle pt-4 text-center">{t("auth.adopt.working")}</Text>
            ) : null}
            {failed ? (
                <Text className="text-danger text-subtitle pt-4 leading-snug">{t("auth.adopt.failed")}</Text>
            ) : null}
        </FirstRun>
    );
}
