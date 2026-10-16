import { useMaterialColors } from "@/theme/use-material-colors";

import type { useChartInk as useChartInkBase } from "./chart-ink";

/** Direction B charts its series in the dynamic primary. */
export const useChartInk: typeof useChartInkBase = () => useMaterialColors().primary;
