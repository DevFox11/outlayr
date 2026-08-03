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
	return (
		fold(trackName).startsWith(wanted) || fold(sellerName).startsWith(wanted)
	);
}
