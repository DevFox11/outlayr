import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	PALETTE_VARIABLES,
	WIDGET_PALETTE,
	type WidgetPalette,
} from "./palette";

const CSS = readFileSync(join(__dirname, "../../global.css"), "utf8");

/** Pulls one `@variant light|dark { … }` block out of the `@layer theme` rules. */
function variantBlock(variant: "light" | "dark"): string {
	const marker = `@variant ${variant} {`;
	const open = CSS.indexOf(marker);
	expect(open).not.toBe(-1);
	const start = open + marker.length;
	const end = CSS.indexOf("}", start);
	expect(end).not.toBe(-1);
	return CSS.slice(start, end);
}

function declaredValue(block: string, variable: string): string | null {
	const match = block.match(new RegExp(`${variable}\\s*:\\s*([^;]+);`));
	return match ? match[1].trim() : null;
}

describe("widget palette", () => {
	for (const variant of ["light", "dark"] as const) {
		it(`matches every ${variant} token declared in global.css`, () => {
			const block = variantBlock(variant);
			for (const [name, variable] of Object.entries(PALETTE_VARIABLES)) {
				expect(WIDGET_PALETTE[variant][name as keyof WidgetPalette]).toBe(
					declaredValue(block, variable),
				);
			}
		});
	}
});
