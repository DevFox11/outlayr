import { useCallback, useRef } from "react";
import type { EnrichmentFn } from "@/lib/convex";
import { fetchMerchantImage } from "@/lib/logo-fetch";
import { type EnrichmentSuggestion, useTransactionEnrichment } from "./use-transaction-enrichment";

export interface AccountLogo {
	imageColor: string | null;
	imageUri: string;
}

export interface UseAccountIdentityArgs {
	/** Read at attach time; false leaves the tile alone. */
	canAttach?: () => boolean;
	enabled: boolean;
	fetchImage?: typeof fetchMerchantImage;
	/** The `groundedLookup` setting. */
	groundedLookup?: boolean;
	locale?: string;
	/** The name resolved to nothing — a previously suggested logo must go. */
	onClear: () => void;
	onLogo: (logo: AccountLogo) => void;
	persistLogo?: (bytes: Uint8Array) => Promise<AccountLogo>;
	regionCode?: string;
	/** The `aiEnrichment` setting. False keeps every lookup on-device. */
	remoteEnabled?: boolean;
	/** Injected in tests; production resolves the real Convex call. */
	transport?: EnrichmentFn | null;
}

export interface UseAccountIdentityResult {
	onNameChange: (next: string) => void;
	pending: boolean;
}

async function persistDefault(bytes: Uint8Array): Promise<AccountLogo> {
	// Required lazily so rendering the editor does not pull Skia's downscaler
	// into the module graph, matching `domain/ids.ts`.
	const photoStorage = require("@/lib/photo-storage") as typeof import("@/lib/photo-storage");
	const { glowFromImage } = require("@/theme/glow") as typeof import("@/theme/glow");
	const imageUri = await photoStorage.persistLogoBytes(bytes);
	const hues = await glowFromImage(imageUri);
	return { imageColor: hues[0] ?? null, imageUri };
}

/**
 * The transaction enrichment protocol with everything but the domain ignored:
 * same debounce rhythm, consent gates, caches and grounded follow-up, consumed
 * only for the logo an account's name resolves to. Category and tag
 * suggestions never reach the caller.
 */
export function useAccountIdentity(args: UseAccountIdentityArgs): UseAccountIdentityResult {
	const {
		enabled,
		remoteEnabled = true,
		groundedLookup = true,
		locale,
		regionCode,
		canAttach,
		onLogo,
		onClear,
		transport,
		fetchImage = fetchMerchantImage,
		persistLogo = persistDefault,
	} = args;

	const nameRef = useRef("");
	const ticketRef = useRef(0);
	const canAttachRef = useRef(canAttach);
	canAttachRef.current = canAttach;
	const onLogoRef = useRef(onLogo);
	onLogoRef.current = onLogo;
	const onClearRef = useRef(onClear);
	onClearRef.current = onClear;
	const fetchImageRef = useRef(fetchImage);
	fetchImageRef.current = fetchImage;
	const persistLogoRef = useRef(persistLogo);
	persistLogoRef.current = persistLogo;

	const attach = useCallback(async (domain: string | null) => {
		const blocked = () => canAttachRef.current?.() === false;
		if (blocked()) {
			return;
		}
		ticketRef.current += 1;
		const ticket = ticketRef.current;
		const stale = () => ticket !== ticketRef.current || blocked();
		if (domain == null) {
			onClearRef.current();
			return;
		}
		const outcome = await fetchImageRef.current({
			domain,
			name: nameRef.current,
		});
		if (stale()) {
			return;
		}
		if (outcome.kind !== "logo") {
			// The new name resolved to nothing, so the previous name's logo has to
			// go with it — keeping it would brand this account wrongly.
			onClearRef.current();
			return;
		}
		let logo: AccountLogo;
		try {
			logo = await persistLogoRef.current(outcome.bytes);
		} catch {
			return;
		}
		if (stale()) {
			return;
		}
		onLogoRef.current(logo);
	}, []);

	const onSuggest = useCallback(
		(suggestion: EnrichmentSuggestion) => {
			attach(suggestion.domain);
		},
		[attach]
	);

	const resolveLocal = useCallback((suggestion: EnrichmentSuggestion) => suggestion, []);

	const enrichment = useTransactionEnrichment({
		categoryTree: [],
		enabled,
		groundedLookup,
		income: false,
		locale,
		onSuggest,
		regionCode,
		remoteEnabled,
		resolveLocal,
		transport,
	});

	const onNameChange = useCallback(
		(next: string) => {
			nameRef.current = next;
			enrichment.onNameChange(next);
		},
		[enrichment.onNameChange]
	);

	return { onNameChange, pending: enrichment.pending };
}
