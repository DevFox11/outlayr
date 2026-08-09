import { readFileSync } from "node:fs";
import { join } from "node:path";

type Declaration = {
	name: string;
	families: string[];
	configured: boolean;
};

/**
 * `app.config.ts` is the only declaration of what a widget is offered, and it
 * cannot be imported here — it pulls in `expo/config` and `dotenv`. So it is
 * read as source and the `WIDGETS` literal is parsed out of it.
 */
function declarations(): Declaration[] {
	const source = readFileSync(join(import.meta.dirname, "..", "..", "app.config.ts"), "utf8");
	const start = source.indexOf("const WIDGETS = [");
	const end = source.indexOf("\n];", start);
	expect(start !== -1 && end !== -1).toBeTruthy();

	// One entry per top-level object in the literal. Splitting on the brace keeps
	// nested `name:` keys — an enum case is one — out of the widget's own.
	return source
		.slice(start, end)
		.split("\n\t{\n")
		.slice(1)
		.map((chunk) => {
			const name = chunk.match(/^\t\tname: "(\w+)",$/m);
			const families = chunk.match(/supportedFamilies: \[([^\]]*)\]/);
			if (!(name && families)) {
				throw new Error(`unparsable widget entry:\n${chunk}`);
			}
			return {
				configured: chunk.includes("configuration: {"),
				families: [...families[1].matchAll(/"(\w+)"/g)].map((m) => m[1]),
				name: name[1],
			};
		});
}

function layout(name: string): string {
	return readFileSync(join(import.meta.dirname, `${name.toLowerCase()}.tsx`), "utf8");
}

describe("widget declarations", () => {
	it("parses every widget out of app.config.ts", () => {
		expect(
			declarations()
				.map((widget) => widget.name)
				.sort()
		).toStrictEqual(["Budget", "Insights", "Ledger", "Log"]);
	});

	/**
	 * A Lock Screen family is a different rendering context, not a smaller tile:
	 * the system flattens it to one tint and gives it a couple of lines. A layout
	 * that declares one without branching on it gets its home screen composition
	 * squeezed into that space, which is how a hero figure ends up unreadable.
	 */
	it("branches on every accessory family it declares", () => {
		for (const widget of declarations()) {
			const source = layout(widget.name);
			for (const family of widget.families) {
				if (!family.startsWith("accessory")) {
					continue;
				}
				expect(source.includes(`"${family}"`)).toBeTruthy();
			}
		}
	});

	// Its Swift counterpart, `RecentTransactionsWidget`, offered both.
	it("gives the ledger the Lock Screen families Swift had", () => {
		const ledger = declarations().find((widget) => widget.name === "Ledger");
		expect(ledger?.families.includes("accessoryRectangular")).toBeTruthy();
		expect(ledger?.families.includes("accessoryInline")).toBeTruthy();
	});

	/**
	 * Declaring a configuration is what puts the "Edit Widget" sheet on the tile.
	 * A layout that then ignores the chosen value leaves the user a control that
	 * silently does nothing.
	 */
	it("reads the configuration it asks the user for", () => {
		const configured = declarations().filter((widget) => widget.configured);
		expect(configured.map((widget) => widget.name).sort()).toStrictEqual(["Budget", "Insights", "Ledger"]);
		for (const widget of configured) {
			expect(layout(widget.name).includes("environment.configuration")).toBeTruthy();
		}
	});
});
