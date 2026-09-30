import { useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useRef, useState } from "react";
import { Alert } from "react-native";

import { useTranslation } from "@/i18n/context";

export function useDiscardGuard() {
    const navigation = useNavigation();
    const router = useRouter();
    const t = useTranslation();
    const [dirty, setDirty] = useState(false);
    const leaving = useRef(false);

    usePreventRemove(dirty, ({ data }) => {
        if (leaving.current) {
            navigation.dispatch(data.action);
            return;
        }
        Alert.alert(t("common.discard.title"), undefined, [
            { style: "cancel", text: t("common.discard.keep") },
            {
                onPress: () => navigation.dispatch(data.action),
                style: "destructive",
                text: t("common.discard.confirm"),
            },
        ]);
    });

    const leave = () => {
        leaving.current = true;
        router.back();
    };

    return { leave, setDirty };
}
