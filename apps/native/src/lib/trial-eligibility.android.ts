import type { trialEligible as iosTrialEligible } from "@/lib/trial-eligibility";

/**
 * RevenueCat can't check trial eligibility on Google Play: it answers UNKNOWN
 * for every product. It doesn't have to, because Play only returns the offers
 * this user can still take. A free or intro phase on the default offer is the
 * answer.
 */
export const trialEligible: typeof iosTrialEligible = (offer) => {
    const option = offer.product.defaultOption;
    return option?.freePhase != null || option?.introPhase != null;
};
