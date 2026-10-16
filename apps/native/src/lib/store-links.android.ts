import { Linking } from "react-native";

import type { openStoreReview as iosOpenStoreReview } from "@/lib/store-links";

const PLAY_STORE_LISTING = "market://details?id=com.tryoutlayr.app";
const PLAY_WEB_LISTING = "https://play.google.com/store/apps/details?id=com.tryoutlayr.app";

/**
 * The listing in the Play Store app. A device without it (a de-Googled phone,
 * an emulator image without Play) has nothing to take `market://`, so it gets
 * the web listing instead.
 */
export const openStoreReview: typeof iosOpenStoreReview = async () => {
    try {
        await Linking.openURL(PLAY_STORE_LISTING);
    } catch {
        await Linking.openURL(PLAY_WEB_LISTING);
    }
};
