import { defineConfig } from "vite-plus";

export default defineConfig({
    test: {
        // A committed `.only` must not silently narrow the suite: fail the run
        // instead, which matches what CI would do anyway.
        allowOnly: false,
        env: {
            COTIZAVE_API_KEY: "test-cotizave-key",
            NATIVE_APP_URL: "outlayr://",
            POSTHOG_PERSONAL_API_KEY: "test-posthog-personal-api-key",
            POSTHOG_PROJECT_ID: "12345",
            REVENUECAT_SECRET_KEY: "test-revenuecat-secret-key",
            REVENUECAT_WEBHOOK_AUTH: "test-revenuecat-webhook-secret-0123456789",
            SITE_URL: "http://localhost:3000",
        },
        // `convex-test` runs functions in a Convex-like runtime, not Node.
        environment: "edge-runtime",
    },
});
