/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as antidumpingDuties from "../antidumpingDuties.js";
import type * as auth from "../auth.js";
import type * as calculationItems from "../calculationItems.js";
import type * as calculations from "../calculations.js";
import type * as cbr from "../cbr.js";
import type * as crons from "../crons.js";
import type * as customsFees from "../customsFees.js";
import type * as exchangeRates from "../exchangeRates.js";
import type * as exciseTariffs from "../exciseTariffs.js";
import type * as exports from "../exports.js";
import type * as fonts_robotoRegular from "../fonts/robotoRegular.js";
import type * as helpers_auth from "../helpers/auth.js";
import type * as helpers_ownership from "../helpers/ownership.js";
import type * as helpers_rateLimit from "../helpers/rateLimit.js";
import type * as http from "../http.js";
import type * as referenceData from "../referenceData.js";
import type * as seed from "../seed.js";
import type * as tks from "../tks.js";
import type * as tnvedCatalog from "../tnvedCatalog.js";
import type * as tnvedTariffs from "../tnvedTariffs.js";
import type * as userProfiles from "../userProfiles.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  antidumpingDuties: typeof antidumpingDuties;
  auth: typeof auth;
  calculationItems: typeof calculationItems;
  calculations: typeof calculations;
  cbr: typeof cbr;
  crons: typeof crons;
  customsFees: typeof customsFees;
  exchangeRates: typeof exchangeRates;
  exciseTariffs: typeof exciseTariffs;
  exports: typeof exports;
  "fonts/robotoRegular": typeof fonts_robotoRegular;
  "helpers/auth": typeof helpers_auth;
  "helpers/ownership": typeof helpers_ownership;
  "helpers/rateLimit": typeof helpers_rateLimit;
  http: typeof http;
  referenceData: typeof referenceData;
  seed: typeof seed;
  tks: typeof tks;
  tnvedCatalog: typeof tnvedCatalog;
  tnvedTariffs: typeof tnvedTariffs;
  userProfiles: typeof userProfiles;
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

export declare const components: {};
