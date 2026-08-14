import { describe, expect, it, jest } from "@jest/globals";

import { createSingleAdoptionRetry } from "./adoption-retry";

describe("adoption retry", () => {
    it("adoption-retries-once", async () => {
        const retry = createSingleAdoptionRetry();
        const reconcile = jest.fn(async () => undefined);

        retry.schedule();
        await expect(retry.run(reconcile)).resolves.toBe(true);
        retry.schedule();
        await expect(retry.run(reconcile)).resolves.toBe(false);
        expect(reconcile).toHaveBeenCalledTimes(1);
    });
});
