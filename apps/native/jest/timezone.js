/**
 * Pins the zone every test runs in. `globalSetup` runs before the workers are
 * forked, so they inherit it. Without this, the suites that reason about local
 * days (savings-goal pace, budget windows) pass in a UTC-negative zone and fail
 * anywhere east of Greenwich, where "22:00Z" is already tomorrow and local
 * midnight of the 1st is still the 30th in UTC. Caracas is where those cases
 * were written and where most of the ledger's data comes from.
 */
module.exports = function pinTimezone() {
    process.env.TZ = "America/Caracas";
};
