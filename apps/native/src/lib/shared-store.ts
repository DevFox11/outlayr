import { requireOptionalNativeModule } from "expo";

interface SharedStoreModule {
    get: (key: string) => string | null;
    remove: (key: string) => void;
    set: (key: string, value: string) => void;
}

export const sharedStore = requireOptionalNativeModule<SharedStoreModule>("SharedStore");
