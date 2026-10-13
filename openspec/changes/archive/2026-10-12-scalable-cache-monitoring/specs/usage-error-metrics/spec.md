## MODIFIED Requirements

### Requirement: Scoped cache summary and CSV export
Cache analysis SHALL summarize the full selected time/model/key/search scope independently of display pagination and cache-state detail filters. Coverage SHALL equal summed cached input divided by summed input, using only successful normal requests with known positive input and known nonnegative cache usage. All other rows SHALL remain visible and exportable when permitted by the detail filter. The scope and excluded usage SHALL be disclosed.

#### Scenario: Weighted page summary
- **GIVEN** successful normal requests with cache/input of 800/1000 and 0/100 on separate display pages
- **WHEN** their filtered summary is displayed
- **THEN** it reports 72.7% from 800/1100 regardless of the selected display page or cache-state detail filter

### Requirement: Filtered cache report export
Export SHALL retrieve all matching retained rows through the authorized cache-record API using cursor pagination, preserve active scope and cache-state filters, ignore the current UI page and reuse the summary's captured time interval and maximum inserted ID. Retrieval failures, repeated or empty intermediate cursor pages, or incomplete results SHALL produce an error without downloading a partial report. Export SHALL not impose a 100000-row limit.

#### Scenario: Export across pages
- **GIVEN** filtered logs occupy several API pages and the operator is on the second UI page
- **WHEN** the operator exports the report
- **THEN** export starts without a cursor and includes every matching retained request within the captured range

#### Scenario: Export fails midway
- **GIVEN** the first export page succeeds and the second page fails
- **WHEN** export completes
- **THEN** an error is displayed and no CSV is downloaded
