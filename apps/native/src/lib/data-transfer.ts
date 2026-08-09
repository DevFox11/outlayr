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
export async function shareText(text: string, fileName: string, mimeType: string, dialogTitle: string): Promise<void> {
	if (!(await Sharing.isAvailableAsync())) {
		throw new TransferError("alerts.transfer.sharingUnavailable");
	}
	const file = new File(Paths.cache, fileName);
	file.create({ intermediates: true, overwrite: true });
	file.write(text);
	await Sharing.shareAsync(file.uri, { dialogTitle, mimeType });
}

export async function shareBytes(
	bytes: Uint8Array,
	fileName: string,
	mimeType: string,
	dialogTitle: string
): Promise<void> {
	if (!(await Sharing.isAvailableAsync())) {
		throw new TransferError("alerts.transfer.sharingUnavailable");
	}
	const file = new File(Paths.cache, fileName);
	file.create({ intermediates: true, overwrite: true });
	file.write(bytes);
	await Sharing.shareAsync(file.uri, { dialogTitle, mimeType });
}

export interface PickedFile {
	name: string;
	text: string;
}

/** Null means the user backed out, which is not an error. */
export async function pickCsvFile(): Promise<PickedFile | null> {
	return await pickTextFile(CSV_TYPES);
}

/**
 * Deliberately permissive about type: iOS reports a `.json` written by another
 * app under any of several UTIs, and a picker that filters too tightly greys out
 * the very file the user is looking at. The contents decide, not the extension —
 * `parseArchive` refuses anything it cannot vouch for.
 */
export async function pickArchiveFile(): Promise<PickedFile | null> {
	return await pickTextFile(["application/json", "public.json", "public.text"]);
}

async function pickTextFile(type: string[]): Promise<PickedFile | null> {
	const result = await DocumentPicker.getDocumentAsync({
		copyToCacheDirectory: true,
		multiple: false,
		type,
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
