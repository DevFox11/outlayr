import Constants from "expo-constants";
import { openBrowserAsync } from "expo-web-browser";
import { View } from "react-native";
import { MonoLabel } from "@/components/mono-label";
import { LinkRow, SettingsSection } from "@/components/settings/settings-row";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { Text } from "@/components/text";

const OUTLAYR_REPO = "https://github.com/danestves/outlayr";
const DIME_REPO = "https://github.com/rafsoh/dimeApp";
const GPL_LICENSE = "https://www.gnu.org/licenses/gpl-3.0.html";

export default function AboutScreen() {
	const version = Constants.expoConfig?.version ?? "1.0.0";

	const open = (url: string) => {
		openBrowserAsync(url);
	};

	return (
		<SettingsScreen footer={`Version ${version}`}>
			<View className="pt-6">
				<Text className="text-body text-foreground leading-relaxed">
					Outlayr is open source and free forever. It is built on the foundation
					of Dime, a beautiful expense tracker created by Rafael Soh, and is
					distributed under the GNU General Public License v3.0.
				</Text>
			</View>

			<SettingsSection title="Links">
				<LinkRow
					icon="SourceCode"
					onPress={() => open(OUTLAYR_REPO)}
					title="Outlayr on GitHub"
				/>
				<LinkRow
					icon="Favourite"
					onPress={() => open(DIME_REPO)}
					title="Dime (original project)"
				/>
				<LinkRow
					icon="License"
					onPress={() => open(GPL_LICENSE)}
					title="GPL-3.0 License"
				/>
			</SettingsSection>

			<View className="gap-2 pt-8">
				<MonoLabel>Licence</MonoLabel>
				<Text className="text-muted text-subtitle leading-relaxed">
					Outlayr is a modified version of Dime, forked in 2026 and changed
					since.
				</Text>
				<Text className="text-muted text-subtitle leading-relaxed">
					Copyright © 2022–2023 Rafael Soh and Dime contributors. Modifications
					copyright © 2026 Daniel Esteves.
				</Text>
				<Text className="text-muted text-subtitle leading-relaxed">
					Outlayr comes with ABSOLUTELY NO WARRANTY, to the extent permitted by
					law. You may redistribute it under the terms of the GNU General Public
					License v3.0.
				</Text>
			</View>
		</SettingsScreen>
	);
}
