/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as cotizave from "../cotizave.js";
import type * as crons from "../crons.js";
import type * as csvImport from "../csvImport.js";
import type * as enrichment from "../enrichment.js";
import type * as exchangeRates from "../exchangeRates.js";
import type * as frankfurter from "../frankfurter.js";
import type * as groundedLookup from "../groundedLookup.js";
import type * as groundedSpend from "../groundedSpend.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bgn from "../lib/bgn.js";
import type * as lib_currencies from "../lib/currencies.js";
import type * as lib_logoAcceptance from "../lib/logoAcceptance.js";
import type * as lib_merchantKey from "../lib/merchantKey.js";
import type * as lib_merchantTrust from "../lib/merchantTrust.js";
import type * as lib_photoKeys from "../lib/photoKeys.js";
import type * as lib_spend from "../lib/spend.js";
import type * as lib_syncTables from "../lib/syncTables.js";
import type * as merchantKnowledge from "../merchantKnowledge.js";
import type * as photos from "../photos.js";
import type * as sync from "../sync.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  cotizave: typeof cotizave;
  crons: typeof crons;
  csvImport: typeof csvImport;
  enrichment: typeof enrichment;
  exchangeRates: typeof exchangeRates;
  frankfurter: typeof frankfurter;
  groundedLookup: typeof groundedLookup;
  groundedSpend: typeof groundedSpend;
  healthCheck: typeof healthCheck;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/bgn": typeof lib_bgn;
  "lib/currencies": typeof lib_currencies;
  "lib/logoAcceptance": typeof lib_logoAcceptance;
  "lib/merchantKey": typeof lib_merchantKey;
  "lib/merchantTrust": typeof lib_merchantTrust;
  "lib/photoKeys": typeof lib_photoKeys;
  "lib/spend": typeof lib_spend;
  "lib/syncTables": typeof lib_syncTables;
  merchantKnowledge: typeof merchantKnowledge;
  photos: typeof photos;
  sync: typeof sync;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
