import { ReduceMotion } from "react-native-reanimated";
import { SPRING_CONFIG } from "./spring";

describe("SPRING_CONFIG", () => {
	it("funnels reduced-motion through the system setting (reference defect §10.3)", () => {
		expect(SPRING_CONFIG.reduceMotion).toBe(ReduceMotion.System);
	});

	it("carries the tuned damping/mass/stiffness lifted from the reference", () => {
		expect(SPRING_CONFIG.damping).toBe(20);
		expect(SPRING_CONFIG.mass).toBe(0.55);
		expect(SPRING_CONFIG.stiffness).toBe(250);
	});
});
