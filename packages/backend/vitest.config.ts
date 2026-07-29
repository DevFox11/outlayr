import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// A committed `.only` must not silently narrow the suite: fail the run
		// instead, which matches what CI would do anyway.
		allowOnly: false,
		// `convex-test` runs functions in a Convex-like runtime, not Node.
		environment: "edge-runtime",
		env: {
			COTIZAVE_API_KEY: "test-cotizave-key",
		},
	},
});
