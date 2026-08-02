import { CATEGORY_PALETTE } from "@/data/categories-core";

export function firstAvailableColor(used: ReadonlySet<string>): string {
	return CATEGORY_PALETTE.find((hex) => !used.has(hex)) ?? "#FFFFFF";
}
