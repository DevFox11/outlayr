import { utcDateString } from "@outlayr/money/dates";

import { uuidV5 } from "@/domain/uuid5";

/**
 * Runs outside the test process, spawned with `TZ` forced by the caller, and
 * prints the occurrence id the sweep would derive. Jest caches the host's own
 * zone the first time any `Date` is touched, so only a fresh process picks up
 * a different one.
 *
 * It re-derives rather than importing `occurrenceId` because that function is
 * private to `recurrence-backfill`, and importing that module here would pull
 * drizzle and the whole db layer into a bare node process.
 */
const OCCURRENCE_NAMESPACE = "0f2b9f1e-6d3a-4c58-9a71-2c8f5d6e4b31";

const [parentLocalId = "", isoHolding = ""] = process.argv.slice(2);
const holding = new Date(isoHolding);

process.stdout.write(uuidV5(`${parentLocalId}:${utcDateString(holding.getTime())}`, OCCURRENCE_NAMESPACE));
