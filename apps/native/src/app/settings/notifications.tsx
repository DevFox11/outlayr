import { SettingsStub } from "@/components/native/settings-stub";

// TODO: port SettingsNotificationsView — permission request + scheduled reminder
// times (Mornings/Evenings/Custom). Needs expo-notifications wiring.
export default function NotificationsScreen() {
	return (
		<SettingsStub
			title="Notifications"
			note="Reminder scheduling isn't wired up yet."
		/>
	);
}
