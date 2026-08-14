import { createSingleAdoptionRetry } from "./adoption-retry";

describe("adoption retry", () => {
    it("adoption-retries-once", async () => {
        const retry = createSingleAdoptionRetry();
        const reconcile = jest.fn(async () => undefined);

        retry.schedule();
        expect(await retry.run(reconcile)).toBe(true);
        retry.schedule();
        expect(await retry.run(reconcile)).toBe(false);
        expect(reconcile).toHaveBeenCalledTimes(1);
    });
});
