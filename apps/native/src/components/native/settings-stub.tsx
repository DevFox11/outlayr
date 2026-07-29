import { Form, Host, Section, Text } from "@expo/ui/swift-ui";
import { Stack } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "@/i18n";
import { secondaryText } from "./styles";

interface SettingsStubProps {
	title: string;
	/** One-line explanation of why the screen is a placeholder. */
	note: string;
}

export function SettingsStub({ title, note }: SettingsStubProps) {
	const t = useTranslation();
	return (
		<View className="flex-1 bg-background">
			<Stack.Title large>{title}</Stack.Title>
			<Host style={{ flex: 1 }} useViewportSizeMeasurement>
				<Form>
					<Section footer={<Text modifiers={[secondaryText]}>{note}</Text>}>
						<Text modifiers={[secondaryText]}>
							{t("settings.stub.notAvailable")}
						</Text>
					</Section>
				</Form>
			</Host>
		</View>
	);
}
