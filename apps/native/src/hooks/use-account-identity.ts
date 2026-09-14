import { useCallback, useEffect, useRef } from "react";

import { resolveInstitutionDomain } from "@/domain/institution-map";
import type { EnrichmentFn } from "@/lib/convex";
import { fetchMerchantImage } from "@/lib/logo-fetch";
import { persistLogo as persistLogoDefault } from "@/lib/persist-logo";

import { useTransactionEnrichment } from "./use-transaction-enrichment";
import type { EnrichmentSuggestion } from "./use-transaction-enrichment";

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
    /**
     * A name the editor opens with. It is looked up once on mount as if it had
     * just been typed, so a carried-over draft is not left with an empty tile.
     */
    initialName?: string;
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

/**
 * The transaction enrichment protocol with everything but the domain ignored:
 * same debounce rhythm, consent gates, caches and grounded follow-up, consumed
 * only for the logo an account's name resolves to. Category and tag
 * suggestions never reach the caller.
 *
 * Its one addition is the institution tier — accounts are named after banks and
 * wallets, which the curated merchant map does not cover and which resolve
 * on-device here rather than costing a model call.
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
        persistLogo = persistLogoDefault,
    } = args;

    const nameRef = useRef("");
    const ticketRef = useRef(0);
    /**
     * The callers as of the last commit. `attach` is a long-lived async chain
     * that outlives the render that started it, so it reads them from here.
     * Mirrored in an effect rather than during render: a ref written while
     * rendering is a side effect the compiler cannot follow.
     */
    const latest = useRef({ canAttach, fetchImage, onClear, onLogo, persistLogo });
    useEffect(() => {
        latest.current = { canAttach, fetchImage, onClear, onLogo, persistLogo };
    });

    const attach = useCallback(async (domain: string | null) => {
        const blocked = () => latest.current.canAttach?.() === false;
        if (blocked()) {
            return;
        }
        ticketRef.current += 1;
        const ticket = ticketRef.current;
        const stale = () => ticket !== ticketRef.current || blocked();
        if (domain == null) {
            latest.current.onClear();
            return;
        }
        const outcome = await latest.current.fetchImage({
            domain,
            name: nameRef.current,
        });
        if (stale()) {
            return;
        }
        if (outcome.kind !== "logo") {
            // The new name resolved to nothing, so the previous name's logo has to
            // go with it — keeping it would brand this account wrongly.
            latest.current.onClear();
            return;
        }
        let logo: AccountLogo;
        try {
            logo = await latest.current.persistLogo(outcome.bytes);
        } catch {
            return;
        }
        if (stale()) {
            return;
        }
        latest.current.onLogo(logo);
    }, []);

    const onSuggest = useCallback(
        (suggestion: EnrichmentSuggestion) => {
            attach(suggestion.domain);
        },
        [attach]
    );

    const resolveLocal = useCallback((suggestion: EnrichmentSuggestion) => suggestion, []);

    const { onNameChange: enrich, pending } = useTransactionEnrichment({
        categoryTree: [],
        enabled,
        groundedLookup,
        income: false,
        locale,
        onSuggest,
        regionCode,
        remoteEnabled,
        // Banks and wallets are what accounts are named after, and the curated
        // merchant map has no opinion about any of them.
        resolveDomain: resolveInstitutionDomain,
        resolveLocal,
        transport,
    });

    const onNameChange = useCallback(
        (next: string) => {
            nameRef.current = next;
            enrich(next);
        },
        [enrich]
    );

    const { initialName } = args;
    useEffect(() => {
        if (enabled && initialName != null && initialName.trim().length > 0) {
            onNameChange(initialName);
        }
        // Once, for the name the editor opened with; later names arrive by typing.
        // oxlint-disable-next-line react/exhaustive-deps -- deliberately mount-only
    }, []);

    // The enrichment teardown cancels its own timers and requests, but not an
    // `attach` already past them: a fetch or persist still pending when the sheet
    // closes would land its logo in the draft the next editor is reading. Taking
    // the ticket on the way out makes every step after an await see it as stale.
    useEffect(
        () => () => {
            ticketRef.current += 1;
        },
        []
    );

    return { onNameChange, pending };
}
