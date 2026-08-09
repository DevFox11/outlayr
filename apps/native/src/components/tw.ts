import { extendTailwindMerge } from "tailwind-merge";
import { createTV } from "tailwind-variants";

/**
 * `tailwind-merge` ships knowing Tailwind's stock scale, not this app's. Every
 * `--text-*` token in `global.css` is an unknown `text-` word to it, so it files
 * `text-body` under *colour* — and a size then cancels against a tone:
 *
 *   cn("text-body", "text-danger")  ->  "text-danger"     (size silently gone)
 *
 * Declaring the sizes is what keeps the two from colliding. Colours need no
 * entry: an unknown `text-*` already falls through to `text-color`, which is
 * where a colour belongs.
 */
const twMergeConfig = {
	extend: {
		classGroups: {
			"font-size": [
				{
					text: [
						"micro",
						"eyebrow",
						"label",
						"footnote",
						"caption",
						"subtitle",
						"body",
						"callout",
						"headline",
						"title",
						"hero",
					],
				},
			],
			tracking: [{ tracking: ["eyebrow", "label", "hero"] }],
		},
	},
} as const;

/**
 * Built on `extendTailwindMerge` rather than `tailwind-variants`' `cnMerge`.
 * `cnMerge(...)({ twMergeConfig })` accepts the option and then does not apply
 * it — verified directly: the same config through `extendTailwindMerge` keeps
 * `text-title`, and through `cnMerge` it still drops it. And the plain `cn`
 * export hardcodes the default config, so it cannot be configured at all.
 */
const merge = extendTailwindMerge(twMergeConfig);

/** Joins class values and resolves conflicts, ignoring falsy so `cond && "..."` works. */
export function cn(...classes: (string | false | null | undefined)[]): string | undefined {
	const joined = classes.filter(Boolean).join(" ");
	return joined === "" ? undefined : merge(joined);
}

export const tv = createTV({ twMergeConfig });
