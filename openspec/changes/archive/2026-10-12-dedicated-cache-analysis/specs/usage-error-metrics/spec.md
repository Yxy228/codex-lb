## MODIFIED Requirements

### Requirement: Per-request cache reporting
The dedicated cache analysis page SHALL show cached input divided by total input as a percentage and exact input, cached, uncached and output token counts in request details. Missing usage SHALL be unknown rather than zero. Known zero cache usage SHALL be a miss. Cached tokens SHALL be clamped to the input total; zero input SHALL have no percentage.

#### Scenario: A partially cached request
- **GIVEN** a request with 1000 input tokens and 800 cached input tokens
- **WHEN** the operator views cache analysis
- **THEN** the row shows 80.0% and its details show 1000 input, 800 cached and 200 uncached tokens

#### Scenario: Unknown usage and genuine misses
- **GIVEN** a cancelled request without usage and a completed request with 1000 input and zero cached tokens
- **WHEN** the operator views cache analysis
- **THEN** the cancelled request shows unknown and the completed request shows a miss at 0.0%

### Requirement: Scoped cache summary and CSV export
Cache analysis SHALL summarize the full filtered retained dataset independently of display pagination. Coverage SHALL equal summed cached input divided by summed input, using only successful normal requests with known positive input and known cache usage. All other rows SHALL remain visible and exportable. The scope and excluded usage SHALL be disclosed.

#### Scenario: Weighted page summary
- **GIVEN** successful normal requests with cache/input of 800/1000 and 0/100 on separate display pages
- **WHEN** their filtered summary is displayed
- **THEN** it reports 72.7% from 800/1100 regardless of the selected display page
