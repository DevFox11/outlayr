import { useWizard, Wizard } from "./index";

describe("wizard barrel export", () => {
	it("exposes the composed Wizard namespace and useWizard", () => {
		expect(typeof Wizard).toBe("function");
		expect(typeof Wizard.Content).toBe("function");
		expect(typeof Wizard.Step).toBe("function");
		expect(typeof Wizard.Actions).toBe("function");
		expect(typeof Wizard.Actions.Item).toBe("function");
		expect(typeof useWizard).toBe("function");
	});
});
