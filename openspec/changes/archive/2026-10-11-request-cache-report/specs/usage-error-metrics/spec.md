## ADDED Requirements

### Requirement: Per-request cache reporting
The request log table SHALL offer a default-visible cache column showing cached input tokens divided by total input tokens as a percentage. Request details SHALL show exact input, cached input, uncached input and output token counts. Missing usage SHALL be displayed as unknown rather than zero. Known zero cache usage SHALL be displayed as a miss. Cached tokens SHALL be clamped to the input total; zero input SHALL have no percentage.

#### Scenario: A partially cached request
- **GIVEN** a request with 1000 input tokens and 800 cached input tokens
- **WHEN** the operator views the request log
- **THEN** its cache column shows 80.0% and its details show 1000 input, 800 cached and 200 uncached tokens

#### Scenario: Unknown usage and genuine misses
- **GIVEN** a cancelled request without usage and a completed request with 1000 input and zero cached tokens
- **WHEN** the operator views the cache column
- **THEN** the cancelled request shows unknown and the completed request shows a miss at 0.0%

### Requirement: Scoped cache summary and CSV export
The cache summary SHALL be labeled as current-page data and SHALL use only successful normal requests with known positive input and known cache usage. Its percentage SHALL equal summed cached input divided by summed total input. All other rows SHALL remain visible and exportable.


#### Scenario: Weighted page summary
- **GIVEN** successful normal requests with cache/input of 800/1000 and 0/100
- **WHEN** their current-page summary is displayed
- **THEN** the summary reports 72.7% from 800/1100

### Requirement: Filtered cache report export
Export SHALL retrieve all matching retained rows through the existing authorized API, preserve active filters, ignore the current page offset and fix the time interval at export start. Retrieval failures SHALL produce an error without downloading a partial report. Export SHALL report an error if the matching result exceeds 100000 rows.

#### Scenario: Export across pages
- **GIVEN** filtered logs occupy several API pages and the operator is on the second UI page
- **WHEN** the operator exports the report
- **THEN** export starts at offset zero and includes every matching retained request within the fixed time interval

#### Scenario: Export fails midway
- **GIVEN** the first export page succeeds and the second page fails
- **WHEN** export completes
- **THEN** an error is displayed and no CSV is downloaded

### Requirement: Cache CSV format
CSV SHALL export exact counts, request identity, timestamp, model, key attribution, status and request kind, leave unknown counts blank, quote fields, neutralize spreadsheet formula prefixes and include a UTF-8 BOM.

#### Scenario: CSV preserves unknown usage
- **GIVEN** a request with unknown input and cached token counts
- **WHEN** the request is exported
- **THEN** these CSV fields are blank and the cache percentage is blank
