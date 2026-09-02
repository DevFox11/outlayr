import { Form, Host, Section, Text } from "@expo/ui/swift-ui";
import { Stack } from "expo-router";
import { View } from "react-native";

import { useTranslation } from "@/i18n/context";
import { useColors } from "@/theme/use-colors";

import { groupedList, groupedRows, secondaryText } from "./styles";

interface SettingsStubProps {
    /** One-line explanation of why the screen is a placeholder. */
    note: string;
    title: string;
}

export function SettingsStub({ title, note }: SettingsStubProps) {
    const t = useTranslation();
    const colors = useColors();
    return (
        <View className="bg-background flex-1">
            <Stack.Title large>{title}</Stack.Title>
            <Host style={{ flex: 1 }} useViewportSizeMeasurement>
                <Form modifiers={groupedList(colors)}>
                    <Section footer={<Text modifiers={[secondaryText]}>{note}</Text>} modifiers={[groupedRows(colors)]}>
                        <Text modifiers={[secondaryText]}>{t("settings.stub.notAvailable")}</Text>
                    </Section>
                </Form>
            </Host>
        </View>
    );
}
