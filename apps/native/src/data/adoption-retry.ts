export interface AdoptionRetry {
    run: (reconcile: () => Promise<void>) => Promise<boolean>;
    schedule: () => void;
}

export function createSingleAdoptionRetry(): AdoptionRetry {
    let pending = false;
    let used = false;

    return {
        async run(reconcile) {
            if (!pending || used) {
                return false;
            }
            pending = false;
            used = true;
            await reconcile();
            return true;
        },
        schedule() {
            if (!used) {
                pending = true;
            }
        },
    };
}
