import { FilterMode, ImageFormat, MipmapMode, Skia } from "@shopify/react-native-skia";
import { Directory, File, Paths } from "expo-file-system";
import { PHOTO_DIRECTORY, type PhotoFiles, photoExtension, photoFileName } from "@/data/photo-store-core";
import { newId } from "@/domain/ids";

/**
 * Matches the Swift ingestion (`TransactionImageIngestion.maxDimension`): the
 * largest a transaction photo is ever drawn is the 132pt identity well, so a
 * full-resolution camera frame is two orders of magnitude of wasted disk.
 */
const MAX_DIMENSION = 512;
const JPEG_QUALITY = 80;

function photoDirectory(): Directory {
	const directory = new Directory(Paths.document, PHOTO_DIRECTORY);
	directory.create({ idempotent: true, intermediates: true });
	return directory;
}

export const photoFiles: PhotoFiles = {
	adopt(sourceUri, name) {
		const source = new File(sourceUri);
		if (!source.exists) {
			return false;
		}
		source.copySync(new File(photoDirectory(), name), { overwrite: true });
		return true;
	},
	get directoryUri() {
		return photoDirectory().uri;
	},

	list() {
		return photoDirectory()
			.list()
			.filter((entry): entry is File => entry instanceof File)
			.map((file) => ({ modifiedAt: file.lastModified ?? 0, name: file.name }));
	},

	read(name) {
		const file = new File(photoDirectory(), name);
		return file.exists ? file.bytesSync() : null;
	},

	remove(name) {
		const file = new File(photoDirectory(), name);
		if (file.exists) {
			file.delete();
		}
	},

	write(name, bytes) {
		const file = new File(photoDirectory(), name);
		file.create({ overwrite: true });
		file.write(bytes);
	},
};

/**
 * Re-encodes the source at no more than {@link MAX_DIMENSION} on its long edge.
 * Answers null rather than throwing on any Skia failure, so a photo the decoder
 * cannot handle still gets stored at full size instead of being lost.
 */
async function downscaleToJpeg(sourceUri: string): Promise<Uint8Array | null> {
	try {
		const data = await Skia.Data.fromURI(sourceUri);
		const image = Skia.Image.MakeImageFromEncoded(data);
		if (image == null) {
			return null;
		}

		const width = image.width();
		const height = image.height();
		const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
		const targetWidth = Math.max(1, Math.round(width * scale));
		const targetHeight = Math.max(1, Math.round(height * scale));

		const surface = Skia.Surface.MakeOffscreen(targetWidth, targetHeight);
		if (surface == null) {
			return null;
		}
		surface
			.getCanvas()
			.drawImageRectOptions(
				image,
				Skia.XYWHRect(0, 0, width, height),
				Skia.XYWHRect(0, 0, targetWidth, targetHeight),
				FilterMode.Linear,
				MipmapMode.Linear
			);
		surface.flush();
		const encoded = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, JPEG_QUALITY);
		return encoded.length > 0 ? encoded : null;
	} catch {
		return null;
	}
}

/**
 * Copies a freshly picked asset into the app's own storage and answers the uri to
 * persist. The picker hands back a path inside a cache directory the system may
 * reclaim whenever it likes, so the returned uri — not the argument — is the only
 * one safe to write to a row.
 */
export async function persistPickedPhoto(sourceUri: string): Promise<string> {
	const directory = photoDirectory();
	const encoded = await downscaleToJpeg(sourceUri);

	if (encoded != null) {
		const target = new File(directory, `${newId()}.jpg`);
		target.create({ overwrite: true });
		target.write(encoded);
		return target.uri;
	}

	const target = new File(directory, `${newId()}${photoExtension(photoFileName(sourceUri))}`);
	new File(sourceUri).copySync(target, { overwrite: true });
	return target.uri;
}

/**
 * A fetched logo arrives as bytes while the persist path takes a uri, so the
 * bytes sit in the cache directory just long enough to go through the same
 * downscale every picked photo does. That re-encode is also what neutralises
 * anything hiding behind a valid image header.
 */
export async function persistLogoBytes(bytes: Uint8Array): Promise<string> {
	const temp = new File(Paths.cache, `${newId()}.img`);
	temp.create({ overwrite: true });
	temp.write(bytes);
	try {
		return await persistPickedPhoto(temp.uri);
	} finally {
		temp.delete();
	}
}

/** Drops every stored photo. Paired with erasing the ledger that references them. */
export function clearStoredPhotos(): void {
	const directory = new Directory(Paths.document, PHOTO_DIRECTORY);
	if (directory.exists) {
		directory.delete();
	}
}
