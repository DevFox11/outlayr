import { LegendList } from "@legendapp/list/react-native";
import { Stack, useRouter } from "expo-router";
import { View } from "react-native";

import { LinkRow } from "@/components/list/list-row";
import { MonoLabel } from "@/components/mono-label";
import { ScreenHeader } from "@/components/screen-header";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";

import licenses from "./licenses.json";

export function Licenses() {
    const router = useRouter();
    return (
        <LegendList
            className="bg-background"
            contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
            contentInsetAdjustmentBehavior="automatic"
            data={licenses}
            keyExtractor={(license) => license.name}
            ListHeaderComponent={<View className="border-border border-t" />}
            renderItem={({ item: license }) => (
                <LinkRow
                    onPress={() =>
                        router.push({ params: { name: license.name }, pathname: "/settings/licenses/[name]" })
                    }
                    title={license.name}
                    value={license.license}
                />
            )}
        />
    );
}

export function LicenseDetail({ name }: { name: string }) {
    const license = licenses.find((entry) => entry.name === name);
    return (
        <SettingsScreen>
            <ScreenHeader title={name} />
            <Stack.Screen.BackButton displayMode="minimal" />
            {license ? (
                <View className="gap-3 pt-6">
                    <MonoLabel>{`${license.version} · ${license.license}`}</MonoLabel>
                    <Text className="text-subtitle text-foreground leading-relaxed" selectable>
                        {license.text}
                    </Text>
                </View>
            ) : null}
        </SettingsScreen>
    );
}
