import { isRealLogo } from "@/domain/logo-acceptance";

/**
 * Verified against the live endpoint: a real merchant answers 200 with
 * distinct bytes, and a domain with no icon answers 404 with a placeholder.
 * `t3.gstatic.com/faviconV2?client=SOCIAL` was rejected — it answers 404 with
 * a byte-identical placeholder for *every* domain, netflix.com included, so a
 * logo tier built on it would silently never produce a logo.
 */
export function logoUrl(domain: string): string {
	return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

const LOGO_TIMEOUT_MS = 3000;

export type LogoOutcome =
	| { kind: "logo"; bytes: Uint8Array }
	| { kind: "none" };

const NONE: LogoOutcome = { kind: "none" };

/**
 * Absence is the designed outcome, never an error: no domain, a refusal, a
 * placeholder, a timeout and a thrown request all return the same `none`, and
 * the caller attaches no image rather than a fallback glyph.
 */
export async function fetchLogo(
	domain: string | null,
	fetchImpl: typeof fetch = fetch,
): Promise<LogoOutcome> {
	if (domain == null || domain.length === 0) {
		return NONE;
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), LOGO_TIMEOUT_MS);
	try {
		const response = await fetchImpl(logoUrl(domain), {
			signal: controller.signal,
		});
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
