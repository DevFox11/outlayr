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
	ink: string;
	muted: string;
	subtle: string;
	border: string;
	income: string;
	over: string;
}

export const WIDGET_PALETTE: Record<"light" | "dark", WidgetPalette> = {
	light: {
		background: "#ffffff",
		ink: "#010101",
		muted: "#6d6d6d",
		subtle: "#6c6c78",
		border: "#ecf0f4",
		income: "#027d51",
		over: "#d61d1f",
	},
	dark: {
		background: "#060a07",
		ink: "#ffffff",
		muted: "#a4a4a9",
		subtle: "#8e8e93",
		border: "#2e2e2e",
		income: "#0fffa9",
		over: "#f17879",
	},
};

/** Maps each palette entry to the `global.css` custom property it mirrors. */
export const PALETTE_VARIABLES: Record<keyof WidgetPalette, string> = {
	background: "--background",
	ink: "--foreground",
	muted: "--muted",
	subtle: "--subtle",
	border: "--border",
	income: "--income",
	over: "--over-budget",
};
