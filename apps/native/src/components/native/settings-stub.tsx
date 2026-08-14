import { Form, Host, Section, Text } from "@expo/ui/swift-ui";
import { Stack } from "expo-router";
import { View } from "react-native";

import { useTranslation } from "@/i18n/context";

import { secondaryText } from "./styles";

interface SettingsStubProps {
    /** One-line explanation of why the screen is a placeholder. */
    note: string;
    title: string;
}

export function SettingsStub({ title, note }: SettingsStubProps) {
    const t = useTranslation();
    return (
        <View className="bg-background flex-1">
            <Stack.Title large>{title}</Stack.Title>
            <Host style={{ flex: 1 }} useViewportSizeMeasurement>
                <Form>
                    <Section footer={<Text modifiers={[secondaryText]}>{note}</Text>}>
                        <Text modifiers={[secondaryText]}>{t("settings.stub.notAvailable")}</Text>
                    </Section>
                </Form>
            </Host>
        </View>
    );
}
