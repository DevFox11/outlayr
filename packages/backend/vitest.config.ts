import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// A committed `.only` must not silently narrow the suite: fail the run
		// instead, which matches what CI would do anyway.
		allowOnly: false,
		env: {
			COTIZAVE_API_KEY: "test-cotizave-key",
			NATIVE_APP_URL: "outlayr://",
			SITE_URL: "http://localhost:3000",
		},
		// `convex-test` runs functions in a Convex-like runtime, not Node.
		environment: "edge-runtime",
	},
});
