import { AndroidConfig, withAndroidManifest } from "expo/config-plugins";
import type { ConfigPlugin } from "expo/config-plugins";

type Manifest = AndroidConfig.Manifest.AndroidManifest["manifest"];

const WRITE_EXTERNAL_STORAGE = "android.permission.WRITE_EXTERNAL_STORAGE";

/** Android 9. From Android 10 the picker's camera check asks for CAMERA alone. */
const LAST_SDK_NEEDING_WRITE = "28";

/** What Play infers from CAMERA and RECORD_AUDIO unless told otherwise. */
const OPTIONAL_FEATURES = [
    "android.hardware.camera",
    "android.hardware.camera.autofocus",
    "android.hardware.microphone",
];

/**
 * Manifest entries for the two capture features, receipt scanning (camera) and
 * voice entry (microphone). The app works without either.
 *
 * - expo-image-picker's `launchCameraAsync` requires WRITE_EXTERNAL_STORAGE
 *   below Android 10, even though the photo lands in app storage, so it can't
 *   be blocked outright. The template declares it up to API 32; this caps it
 *   at the last level that asks.
 * - CAMERA and RECORD_AUDIO make Play infer required camera, autofocus and
 *   microphone hardware, which hides the app from Chromebooks and
 *   front-camera-only tablets. Declaring them optional keeps it listed there.
 */
const withAndroidCapture: ConfigPlugin = (config) =>
    withAndroidManifest(config, (manifestConfig) => {
        const { manifest } = AndroidConfig.Manifest.ensureToolsAvailable(manifestConfig.modResults);
        capWriteExternalStorage(manifest);
        declareOptionalFeatures(manifest);
        return manifestConfig;
    });

function capWriteExternalStorage(manifest: Manifest): void {
    const cap = { "android:maxSdkVersion": LAST_SDK_NEEDING_WRITE, "tools:replace": "android:maxSdkVersion" };
    const permissions = manifest["uses-permission"] ?? [];
    const declared = permissions.find((permission) => permission.$["android:name"] === WRITE_EXTERNAL_STORAGE);
    if (declared) {
        Object.assign(declared.$, cap);
    } else {
        permissions.push({ $: { "android:name": WRITE_EXTERNAL_STORAGE, ...cap } });
    }
    manifest["uses-permission"] = permissions;
}

function declareOptionalFeatures(manifest: Manifest): void {
    const features = (manifest["uses-feature"] ?? []).filter(
        (feature) => !OPTIONAL_FEATURES.includes(feature.$["android:name"])
    );
    for (const name of OPTIONAL_FEATURES) {
        features.push({ $: { "android:name": name, "android:required": "false" } });
    }
    manifest["uses-feature"] = features;
}

export default withAndroidCapture;
