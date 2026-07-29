import { Form, Host, Section, Text } from "@expo/ui/swift-ui";
import { Stack } from "expo-router";
import { View } from "react-native";
import { secondaryText } from "./styles";

interface SettingsStubProps {
	title: string;
	/** One-line explanation of why the screen is a placeholder. */
	note: string;
}

export function SettingsStub({ title, note }: SettingsStubProps) {
	return (
		<View className="flex-1 bg-background">
			<Stack.Title large>{title}</Stack.Title>
			<Host style={{ flex: 1 }} useViewportSizeMeasurement>
				<Form>
					<Section footer={<Text modifiers={[secondaryText]}>{note}</Text>}>
						<Text modifiers={[secondaryText]}>Not available yet</Text>
					</Section>
				</Form>
			</Host>
		</View>
	);
}
