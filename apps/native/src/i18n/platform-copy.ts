import type { Catalog } from "./translate";

/**
 * The catalog as this platform reads it. The copy is written for iOS, so iOS
 * reads every key as written; the Android sibling swaps in the `.android` twins.
 */
export function platformCopy(catalog: Catalog): Catalog {
    return catalog;
}
