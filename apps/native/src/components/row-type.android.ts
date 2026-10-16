import type { ROW_TYPE as ROW_TYPE_BASE } from "./row-type";

/**
 * Direction B: a Material 3 two-line list item. The first line is bodyLarge
 * (16/24) in the regular weight, the second bodyMedium (14/20), and figures
 * sit at 16/24 in the medium weight rather than iOS's semibold.
 */
export const ROW_TYPE = {
    amount: "font-sans-medium text-body leading-6",
    balance: "font-sans-medium text-body leading-6",
    cell: "font-sans-medium text-body",
    name: "font-sans text-body leading-6",
    subtitle: "font-sans text-caption leading-5",
    subtotal: "font-sans-medium",
    title: "font-sans text-body leading-6",
} as const satisfies Record<keyof typeof ROW_TYPE_BASE, string>;
