import { SettingsStub } from "@/components/native/settings-stub";

// TODO: port SettingsAppIconView — alternate icon picker (Default/Ink/Hairline/
// Mono/Emboss). Needs an alternate-app-icon module (none installed) to call
// setAlternateIconName.
export default function AppIconScreen() {
	return (
		<SettingsStub
			title="App Icon"
			note="Alternate app icons aren't selectable yet."
		/>
	);
}
