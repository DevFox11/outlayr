import type { Plan } from "@/domain/pro-plans";

export interface StoreTermsProps {
    /** The plan the buy button would buy, when there is one to buy. */
    plan: Plan | null;
}

/**
 * The store's own subscription terms, under the plans. iOS has nothing to add
 * here: StoreKit's purchase sheet states them. `store-terms.android.tsx` is
 * where Google Play's go.
 */
export function StoreTerms(_props: StoreTermsProps) {
    return null;
}
