import { bumpRatesRevision, ratesRevision, subscribeRatesRevision } from "./rates-revision";

describe("rates revision", () => {
    it("advances on every bump", () => {
        const before = ratesRevision();
        bumpRatesRevision();
        bumpRatesRevision();
        expect(ratesRevision()).toBe(before + 2);
    });

    it("notifies a subscriber", () => {
        let seen = 0;
        const unsubscribe = subscribeRatesRevision(() => {
            seen += 1;
        });
        bumpRatesRevision();
        unsubscribe();
        expect(seen).toBe(1);
    });

    it("stops notifying once unsubscribed", () => {
        let seen = 0;
        const unsubscribe = subscribeRatesRevision(() => {
            seen += 1;
        });
        unsubscribe();
        bumpRatesRevision();
        expect(seen).toBe(0);
    });

    it("reads back the same value until something bumps it", () => {
        // `useSyncExternalStore` calls the getter on every render and loops forever
        // if it answers differently without a store notification.
        expect(ratesRevision()).toBe(ratesRevision());
    });
});
