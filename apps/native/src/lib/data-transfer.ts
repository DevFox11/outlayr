import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { TranslationKey } from "@/i18n";

/**
 * `text/plain` is carried alongside the CSV types because plenty of banks hand
 * out `.csv` files typed as plain text, and a picker that hides them looks
 * broken rather than strict.
 */
const CSV_TYPES = ["text/csv", "text/comma-separated-values", "text/plain"];

/**
 * Carries a catalog key, not a sentence: every catch site puts this straight
 * into an `Alert` body, so a literal message would reach the user in English
 * whatever their language. `message` keeps the key so a crash log still names
 * the failure.
 */
export class TransferError extends Error {
	readonly key: TranslationKey;

	constructor(key: TranslationKey) {
		super(key);
		this.key = key;
	}
}

/**
 * Hands a file to the system share sheet. The sheet is used rather than a photo
 * or Files write because it needs no permission and already offers every
 * destination the user has.
 */
export async function shareText(
	text: string,
	fileName: string,
	mimeType: string,
	dialogTitle: string,
): Promise<void> {
	if (!(await Sharing.isAvailableAsync())) {
		throw new TransferError("alerts.transfer.sharingUnavailable");
	}
	const file = new File(Paths.cache, fileName);
	file.create({ overwrite: true, intermediates: true });
	file.write(text);
	await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}

export async function shareBytes(
	bytes: Uint8Array,
	fileName: string,
	mimeType: string,
	dialogTitle: string,
): Promise<void> {
	if (!(await Sharing.isAvailableAsync())) {
		throw new TransferError("alerts.transfer.sharingUnavailable");
	}
	const file = new File(Paths.cache, fileName);
	file.create({ overwrite: true, intermediates: true });
	file.write(bytes);
	await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}

export interface PickedFile {
	name: string;
	text: string;
}

/** Null means the user backed out, which is not an error. */
export async function pickCsvFile(): Promise<PickedFile | null> {
	const result = await DocumentPicker.getDocumentAsync({
		type: CSV_TYPES,
		copyToCacheDirectory: true,
		multiple: false,
	});
	const asset = result.canceled ? null : result.assets[0];
	if (asset == null) {
		return null;
	}

	let text: string;
	try {
		text = await new File(asset.uri).text();
	} catch {
		throw new TransferError("alerts.transfer.unreadableFile");
	}
	return { name: asset.name, text };
}
