export type CatalogDecimals = 0 | 2 | 3;

export interface CatalogMeta {
    name: string;
    symbol: string;
}

export interface BuiltCatalog {
    codes: string[];
    decimals: Record<string, CatalogDecimals>;
    meta: Record<string, CatalogMeta>;
}

export function buildCatalog(): BuiltCatalog;
