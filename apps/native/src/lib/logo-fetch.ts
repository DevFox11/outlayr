import { env } from "@outlayr/env/native";

import { isRealLogo } from "@/domain/logo-acceptance";

const REQUEST_TIMEOUT_MS = 3000;
/**
 * One more try after a timeout. A cold TLS handshake from the simulator can
 * alone exceed the budget, and the second attempt reuses the connection.
 */
const TIMEOUT_ATTEMPTS = 2;

export type LogoOutcome = { kind: "logo"; bytes: Uint8Array } | { kind: "none" };

const NONE: LogoOutcome = { kind: "none" };

/**
 * A tier's answer, and whether "none" is an answer at all. A server that
 * looked and said no is definitive; a timeout, a thrown request, a rate limit
 * or a server error says nothing about the merchant and must not be remembered
 * as if it had — that is how two banks with perfectly good logos ended up
 * unable to take one, from a single bad minute.
 */
type TierOutcome = { kind: "logo"; bytes: Uint8Array } | { definitive: boolean; kind: "none" };

const INDETERMINATE: TierOutcome = { definitive: false, kind: "none" };
const REFUSED: TierOutcome = { definitive: true, kind: "none" };

const NOT_FOUND = 404;
const OK_MIN = 200;
const OK_MAX = 299;

/**
 * Whether a status is the server's verdict on the merchant rather than on the
 * request. Not-found is; so is a 2xx whose body the acceptance filter turned
 * down, since the host looked and served a placeholder. Everything else — auth,
 * timeouts the host reports, rate limits, server errors — says nothing about
 * the logo and must not be remembered as if it did.
 */
function refused(status: number): boolean {
    return status === NOT_FOUND || (status >= OK_MIN && status <= OK_MAX);
}

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

async function fetchOnce(url: string, fetchImpl: typeof fetch): Promise<TierOutcome | "timeout"> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetchImpl(url, { signal: controller.signal });
        const bytes = new Uint8Array(await response.arrayBuffer());
        const verdict = isRealLogo(response.status, response.headers.get("content-type"), bytes);
        if (verdict.ok) {
            return { bytes, kind: "logo" };
        }
        return refused(response.status) ? REFUSED : INDETERMINATE;
    } catch {
        return controller.signal.aborted ? "timeout" : INDETERMINATE;
    } finally {
        clearTimeout(timer);
    }
}

async function fetchAccepted(url: string, fetchImpl: typeof fetch): Promise<TierOutcome> {
    for (let attempt = 1; attempt <= TIMEOUT_ATTEMPTS; attempt += 1) {
        // oxlint-disable-next-line no-await-in-loop -- a retry only makes sense once the first attempt has timed out
        const outcome = await fetchOnce(url, fetchImpl);
        if (outcome !== "timeout") {
            return outcome;
        }
    }
    return INDETERMINATE;
}

export interface MerchantImageRequest {
    /** The resolved domain, used by the logo and favicon tiers. */
    domain: string | null;
    /** What the user typed; folded into the on-device cache key. */
    name: string;
    /**
     * Ask the tiers again even if this key was remembered as a miss. A cached
     * logo is still served: the key carries the domain, so a different answer
     * from the model is a different key anyway.
     */
    refresh?: boolean;
}

/**
 * Absence stays the designed outcome at every tier: a refusal, a placeholder,
 * a timeout and a thrown request all fall through to the next source and then
 * to no image — never a letter avatar, never a broken frame.
 */
export async function fetchMerchantImage(
    request: MerchantImageRequest,
    fetchImpl: typeof fetch = fetch
): Promise<LogoOutcome> {
    // Required lazily so importing this module does not pull expo-file-system
    // into every consumer's graph, matching `domain/ids.ts`. A cache that will
    // not load is not a failure — it costs one request.
    let cache: typeof import("@/lib/logo-cache") | null = null;
    try {
        // SAFETY: untyped `require`, asserted to that module's own type.
        cache = require("@/lib/logo-cache") as typeof import("@/lib/logo-cache");
    } catch {
        cache = null;
    }
    const key = cache?.logoCacheKey(request.name.trim(), request.domain) ?? "";
    const cached = (await cache?.readCachedLogo(key)) ?? {
        kind: "unknown" as const,
    };
    if (cached.kind === "logo") {
        return { bytes: cached.bytes, kind: "logo" };
    }
    if (cached.kind === "miss" && request.refresh !== true) {
        return NONE;
    }

    // A request with no domain asks nothing of any tier, so its "miss" is not an
    // answer — it is the absence of a question. Remembering it poisons the name:
    // enrichment calls this for partial spellings too, and the key is folded from
    // whatever is in the field WHEN THE CALL RESOLVES, so typing "Netflix" one
    // letter at a time could file a miss under the finished name and leave that
    // merchant unable to take a logo ever again.
    if (request.domain == null || request.domain.length === 0) {
        return NONE;
    }
    const outcome = await resolveMerchantImage(request, fetchImpl);
    if (outcome.kind === "logo") {
        cache?.writeCachedLogo(key, outcome.bytes);
        return outcome;
    }
    // A real miss IS remembered: without that, every merchant these tiers cannot
    // answer for is re-queried on every form, forever. Only a real one, though —
    // a tier that never answered leaves the key unknown, so the next keystroke
    // asks again.
    if (outcome.definitive) {
        cache?.writeCachedLogo(key, null);
    }
    return NONE;
}

/**
 * No App Store tier here: Apple's Search API permits app icons only on pages
 * promoting that store content, next to a "Download on App Store" badge —
 * never to promote other goods or services, which is what a merchant logo
 * row on a transaction would be doing. Do not reintroduce it.
 */
async function resolveMerchantImage(request: MerchantImageRequest, fetchImpl: typeof fetch): Promise<TierOutcome> {
    const { domain } = request;
    if (domain == null || domain.length === 0) {
        return INDETERMINATE;
    }

    let definitive = true;
    const token = env.EXPO_PUBLIC_LOGO_DEV_TOKEN;
    if (token) {
        const branded = await fetchAccepted(logoDevUrl(domain, token), fetchImpl);
        if (branded.kind === "logo") {
            return branded;
        }
        ({ definitive } = branded);
    }

    const favicon = await fetchAccepted(faviconUrl(domain), fetchImpl);
    if (favicon.kind === "logo") {
        return favicon;
    }
    // Every tier has to have actually said no before the name is written off.
    return definitive && favicon.definitive ? REFUSED : INDETERMINATE;
}
