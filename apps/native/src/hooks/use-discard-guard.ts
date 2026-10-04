import { usePreventRemove, useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { useTranslation } from "@/i18n/context";

export function useDiscardGuard() {
    const router = useRouter();
    const t = useTranslation();
    const [dirty, setDirty] = useState(false);

    const disablePrevention = usePreventRemove(dirty, ({ repeat }) => {
        Alert.alert(t("common.discard.title"), undefined, [
            { style: "cancel", text: t("common.discard.keep") },
            {
                onPress: () => {
                    setDirty(false);
                    repeat();
                },
                style: "destructive",
                text: t("common.discard.confirm"),
            },
        ]);
    });

    const leave = () => {
        setDirty(false);
        disablePrevention();
        router.back();
    };

    return { leave, setDirty };
}
