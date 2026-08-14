/**
 * The Grid palette, flattened for the widget runtime.
 *
 * A widget body is stringified by babel and evaluated inside the widget
 * extension's own `JSContext` (see `expo-widgets`' `WidgetsJSRuntime`), so it
 * cannot import `useColors` or read `global.css` — nothing from this bundle's
 * module scope is in scope there. Colours have to arrive as plain hex in props,
 * which means they have to be written down statically somewhere.
 *
 * Both schemes ship, not just the app's current one: a widget renders in
 * whatever appearance the home screen is in, independent of the app, and picks
 * its side from `environment.colorScheme`.
 *
 * `palette.test.ts` parses `global.css` and fails if any value here has drifted,
 * so this stays a projection of the stylesheet rather than a second source of
 * truth.
 */
export interface WidgetPalette {
	background: string;
	border: string;
	income: string;
	ink: string;
	muted: string;
	over: string;
	subtle: string;
}

export const WIDGET_PALETTE: Record<"light" | "dark", WidgetPalette> = {
	dark: {
		background: "#17150f",
		border: "#353026",
		income: "#3fd99b",
		ink: "#f2efe8",
		muted: "#a8a093",
		over: "#f17879",
		subtle: "#968e80",
	},
	light: {
		background: "#f2f0ea",
		border: "#dcd8cc",
		income: "#00714a",
		ink: "#17150f",
		muted: "#6b6557",
		over: "#bd1c1e",
		subtle: "#6d6657",
	},
};

/** Maps each palette entry to the `global.css` custom property it mirrors. */
export const PALETTE_VARIABLES: Record<keyof WidgetPalette, string> = {
	background: "--background",
	border: "--border",
	income: "--income",
	ink: "--foreground",
	muted: "--muted",
	over: "--over-budget",
	subtle: "--subtle",
};
