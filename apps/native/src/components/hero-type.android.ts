import type { HERO_TYPE as HERO_TYPE_BASE } from "./hero-type";

/**
 * Direction B keeps the brand in its hero figures: Instrument Serif, a quarter
 * larger than the sans it replaces (50 over 40 on the Log), because the serif
 * runs condensed and would otherwise read smaller than the ledger under it.
 */
export const HERO_TYPE: typeof HERO_TYPE_BASE = { face: { fontFamily: "InstrumentSerif_400Regular" }, scale: 1.25 };
