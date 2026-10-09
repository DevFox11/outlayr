/**
 * Metro turns an image import into an asset-registry id, but nothing in the Expo
 * dependency tree types that — importing a `.png` is a TS2307 until something says
 * what the module is. Add a sibling block here when the app starts importing other
 * asset kinds.
 */
declare module "*.png" {
    const asset: import("react-native").ImageRequireSource;
    export default asset;
}

declare module "*.jpg" {
    const asset: import("react-native").ImageRequireSource;
    export default asset;
}

declare module "*.webp" {
    const asset: import("react-native").ImageRequireSource;
    export default asset;
}
