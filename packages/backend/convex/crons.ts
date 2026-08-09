import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("refresh frankfurter rates", { hours: 12 }, internal.frankfurter.fetchRates, {});

crons.interval("refresh cotizave ves rates", { minutes: 72 }, internal.cotizave.fetchRates, {});

crons.interval("prune stale exchange rates", { hours: 24 }, internal.exchangeRates.pruneStale, {});

export default crons;
