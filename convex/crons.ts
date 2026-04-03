import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("fetch CBR rates", { hours: 4 }, internal.cbr.fetchRatesCron);
crons.daily("archive stale drafts", { hourUTC: 3, minuteUTC: 0 }, internal.calculations.archiveStaleDrafts);
crons.daily("refresh stale tariffs", { hourUTC: 4, minuteUTC: 0 }, internal.tks.refreshStaleTariffs);
export default crons;
