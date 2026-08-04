import { env } from "@outlayr/env/native";
import { isPlausibleAppMatch } from "@/domain/app-icon-match";
import { isRealLogo } from "@/domain/logo-acceptance";

const REQUEST_TIMEOUT_MS = 3000;

export type LogoOutcome =
	| { kind: "logo"; bytes: Uint8Array }
	| { kind: "none" };

const NONE: LogoOutcome = { kind: "none" };

/**
 * An App Store icon, sized for exactly the rounded square the identity well
 * draws. A favicon is a 16-32px browser affordance and reads as a blurry crop
 * at that size, which is why this is tried first.
 */
export function appIconSearchUrl(term: string): string {
	return `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=1&country=US`;
}

/**
 * Brand logos by domain — the tier that covers what has no App Store app, a
 * utility or a supermarket. The token is publishable and belongs in the bundle.
 *
 * `fallback=404` is load-bearing, not tidiness: the default is `monogram`,
 * which answers 200 with a generic letter tile for a domain it has never heard
 * of. That is precisely the letter avatar this feature promises never to show,
 * and it would arrive looking like a success.
 */
export function logoDevUrl(domain: string, token: string): string {
	return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&size=512&format=png&fallback=404`;
}

/** The browser favicon. Last resort — small, and often a tight crop. */
export function faviconUrl(domain: string): string {
	return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

async function fetchAccepted(
	url: string,
	fetchImpl: typeof fetch,
): Promise<LogoOutcome> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetchImpl(url, { signal: controller.signal });
		const bytes = new Uint8Array(await response.arrayBuffer());
		const verdict = isRealLogo(
			response.status,
			response.headers.get("content-type"),
			bytes,
		);
		return verdict.ok ? { kind: "logo", bytes } : NONE;
	} catch {
		return NONE;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * The App Store search answers every query with something, so the top hit is
 * only taken when its own title or publisher still reads as the typed name —
 * see `isPlausibleAppMatch`. Without that guard an unknown merchant is handed
 * an unrelated company's icon, which is worse than no image at all.
 */
async function fetchAppIcon(
	term: string,
	fetchImpl: typeof fetch,
): Promise<LogoOutcome> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	let artwork: string | null = null;
	try {
		const response = await fetchImpl(appIconSearchUrl(term), {
			signal: controller.signal,
		});
		if (response.status !== 200) {
			return NONE;
		}
		const payload = (await response.json()) as {
			results?: {
				trackName?: string;
				sellerName?: string;
				artworkUrl512?: string;
				artworkUrl100?: string;
			}[];
		};
		const hit = payload.results?.[0];
		if (
			hit == null ||
			!isPlausibleAppMatch(term, hit.trackName ?? "", hit.sellerName ?? "")
		) {
			return NONE;
		}
		artwork = hit.artworkUrl512 ?? hit.artworkUrl100 ?? null;
	} catch {
		return NONE;
	} finally {
		clearTimeout(timer);
	}
	return artwork == null ? NONE : fetchAccepted(artwork, fetchImpl);
}

export interface MerchantImageRequest {
	/** What the user typed, used to look the service up in the App Store. */
	name: string;
	/** The resolved domain, used by the logo and favicon tiers. */
	domain: string | null;
	/** A signed url from a `merchantKnowledge` cache hit, if any. */
	logoUrl?: string | null;
	/** The shared-cache object key backing `logoUrl`, folded into the on-device cache key. */
	logoKey?: string | null;
}

/**
 * Absence stays the designed outcome at every tier: a refusal, a placeholder,
 * a timeout and a thrown request all fall through to the next source and then
 * to no image — never a letter avatar, never a broken frame.
 */
export async function fetchMerchantImage(
	request: MerchantImageRequest,
	fetchImpl: typeof fetch = fetch,
): Promise<LogoOutcome> {
	// Required lazily so importing this module does not pull expo-file-system
	// into every consumer's graph, matching `domain/ids.ts`. A cache that will
	// not load is not a failure — it costs one request.
	let cache: typeof import("@/lib/logo-cache") | null = null;
	try {
		cache = require("@/lib/logo-cache") as typeof import("@/lib/logo-cache");
	} catch {
		cache = null;
	}
	const key =
		cache?.logoCacheKey(request.name.trim(), request.domain, request.logoKey) ??
		"";
	const cached = (await cache?.readCachedLogo(key)) ?? {
		kind: "unknown" as const,
	};
	if (cached.kind === "logo") {
		return { kind: "logo", bytes: cached.bytes };
	}
	if (cached.kind === "miss") {
		return NONE;
	}

	const outcome = await resolveMerchantImage(request, fetchImpl);
	// Misses are remembered too: without that, every merchant these three tiers
	// cannot answer for is re-queried on every form, forever.
	cache?.writeCachedLogo(key, outcome.kind === "logo" ? outcome.bytes : null);
	return outcome;
}

async function resolveMerchantImage(
	request: MerchantImageRequest,
	fetchImpl: typeof fetch,
): Promise<LogoOutcome> {
	const term = request.name.trim();
	if (term.length >= 3) {
		const icon = await fetchAppIcon(term, fetchImpl);
		if (icon.kind === "logo") {
			return icon;
		}
	}

	if (request.logoUrl) {
		const shared = await fetchAccepted(request.logoUrl, fetchImpl);
		if (shared.kind === "logo") {
			return shared;
		}
	}

	const domain = request.domain;
	if (domain == null || domain.length === 0) {
		return NONE;
	}

	const token = env.EXPO_PUBLIC_LOGO_DEV_TOKEN;
	if (token) {
		const branded = await fetchAccepted(logoDevUrl(domain, token), fetchImpl);
		if (branded.kind === "logo") {
			return branded;
		}
	}

	return fetchAccepted(faviconUrl(domain), fetchImpl);
}
