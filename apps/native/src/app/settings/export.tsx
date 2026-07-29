import { SettingsStub } from "@/components/native/settings-stub";

// TODO: port exportFile() — build a CSV from all transactions and hand it to the
// system share sheet (expo-sharing / expo-file-system).
export default function ExportDataScreen() {
	return (
		<SettingsStub
			title="Export Data"
			note="Exporting transactions to CSV isn't available yet."
		/>
	);
}
