import type { PurchasesPackage } from "react-native-purchases";

/**
 * Whether this user can still take the offer's free trial. The App Store
 * answers per product, through RevenueCat's eligibility check run beforehand.
 */
export function trialEligible(offer: PurchasesPackage, eligible: ReadonlySet<string>): boolean {
    return eligible.has(offer.product.identifier);
}
