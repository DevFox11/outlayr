const listeners = new Set<() => void>();
let bursts = 0;

export const celebration = {
    bursts: () => bursts,
    fire() {
        bursts += 1;
        for (const listener of listeners) {
            listener();
        }
    },
    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};
