function fold(raw: string): string {
	return raw
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * The App Store search always answers with *something* — "trader joes" returns
 * a third-party grocery finder, and a nonsense string returns a real unrelated
 * app. Accepting the top hit unguarded would stamp another company's icon on a
 * transaction, which is the one error worse than no image at all.
 *
 * A hit counts only when the typed name still reads as the app's own: it opens
 * the title (`Netflix` → "Netflix", `spotify` → "Spotify: Music and Podcasts")
 * or it opens the publisher (`con edison` → "Con Edison"). Containment anywhere
 * is deliberately not enough — "uber" appears inside "Uber Eats" and inside
 * plenty of apps that are not Uber.
 */
export function isPlausibleAppMatch(
	query: string,
	trackName: string,
	sellerName: string,
): boolean {
	const wanted = fold(query);
	if (wanted.length < 3) {
		return false;
	}
	const track = fold(trackName);
	if (track.startsWith(wanted) || fold(sellerName).startsWith(wanted)) {
		return true;
	}
	// The other direction, for a typed name carrying a word the store drops:
	// "Disney Plus" against the app called "Disney+". Title only — a publisher
	// is far too broad to read backwards, and "Apple" would then claim every
	// query that merely begins with it.
	return track.length >= 4 && wanted.startsWith(track);
}
