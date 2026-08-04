import { env } from "@outlayr/env/native";
import { isRealLogo } from "@/domain/logo-acceptance";

const REQUEST_TIMEOUT_MS = 3000;

export type LogoOutcome =
	| { kind: "logo"; bytes: Uint8Array }
	| { kind: "none" };

const NONE: LogoOutcome = { kind: "none" };

/**
 * Brand logos by domain — covers a utility, a supermarket, or any merchant
 * with a known domain. The token is publishable and belongs in the bundle.
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

export interface MerchantImageRequest {
	/** What the user typed; folded into the on-device cache key. */
	name: string;
	/** The resolved domain, used by the logo and favicon tiers. */
	domain: string | null;
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
	const key = cache?.logoCacheKey(request.name.trim(), request.domain) ?? "";
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

/**
 * No App Store tier here: Apple's Search API permits app icons only on pages
 * promoting that store content, next to a "Download on App Store" badge —
 * never to promote other goods or services, which is what a merchant logo
 * row on a transaction would be doing. Do not reintroduce it.
 */
async function resolveMerchantImage(
	request: MerchantImageRequest,
	fetchImpl: typeof fetch,
): Promise<LogoOutcome> {
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
