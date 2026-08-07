// `@outlayr/env/native` validates at import time and Convex is required, so any
// suite that transitively imports `lib/convex.ts` throws "Invalid environment
// variables" before a single test runs. Jest never loads `.env`, so the values
// have to be planted here — any real-looking URL will do, nothing dials out.
process.env.EXPO_PUBLIC_CONVEX_URL ??= "https://test.convex.cloud";
process.env.EXPO_PUBLIC_CONVEX_SITE_URL ??= "https://test.convex.site";
