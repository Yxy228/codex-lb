# Cache monitoring context

The page defaults to assigned-key traffic. Historical requests without a recorded key remain available only through explicit all/unassigned scopes; no attribution is guessed or backfilled.

Headlines summarize the selected time/model/key/search scope. Hit/miss/unknown controls are a lens for request rows and CSV only, so selecting hits does not inflate the headline hit rate to 100%.

SQL computes full retained-scope totals. Browsers load up to 40 trend entries plus the active 15-row detail page. The captured time bounds and maximum inserted ID travel with requested-at/id cursor pagination and on-demand 1000-row export pages. Later-inserted old-started requests cannot shift pages inside this boundary.

The insertion boundary is not a durable MVCC snapshot. Existing-row corrections, retention or deletion may still change the underlying data; CSV checks total counts and completion before downloading. Very large CSVs need browser memory proportional to file size, and SQL aggregation still scans retained logs. No extra monitoring service, persistent dataset copy or model migration is introduced.
