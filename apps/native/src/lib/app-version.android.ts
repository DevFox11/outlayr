import { nativeBuildVersion } from "expo-application";
import Constants from "expo-constants";

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

/** The versionCode. Constants only carries the iOS build number, which Android leaves empty. */
export const APP_BUILD = nativeBuildVersion ?? "";
