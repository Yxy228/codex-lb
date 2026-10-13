# cache-analysis Specification

## Purpose
TBD - created by archiving change dedicated-cache-analysis. Update Purpose after archive.

## Requirements

### Requirement: Dedicated cache page
A lazy-loaded /reports/cache route SHALL provide cache analysis under the existing dashboard-read permission. Report navigation and the dashboard SHALL link to it. It SHALL show full-range coverage and request hit counts, a recent-request chart, filters, paginated request records, details and CSV export. The generic request table SHALL no longer carry the added cache column, summary or export control.

#### Scenario: Navigation to cache analysis
- **WHEN** an operator opens the cache analysis link from the dashboard or report navigation
- **THEN** the independent cache page renders

### Requirement: Responsive cache browsing
The page SHALL support time range, model, API key when permitted, text search and cache hit/miss/unknown filters. Time, model, key scope and text search SHALL apply to summary, trend, detail rows and export. Cache-state filters SHALL apply only to detail rows and export; headline metrics and trend SHALL retain the whole selected scope. Filters SHALL reset pagination. Assigned-key requests SHALL be selected by default; all and unattributed traffic SHALL require explicit selection. The page SHALL fit a 390px viewport without document horizontal scrolling. API key controls SHALL be absent without api_keys:read permission.

#### Scenario: Cache-state filtering preserves headline metrics
- **WHEN** the operator selects only cache hits
- **THEN** the detail list and export contain only hits
- **AND** the headline hit rate still includes eligible misses in the selected time/model/key/search scope

#### Scenario: Historical unattributed traffic
- **WHEN** the page initially loads
- **THEN** unattributed requests are excluded
- **AND** the scope is visibly labeled

#### Scenario: Missing usage filter
- **GIVEN** a completed cache miss and a cancelled request with missing usage
- **WHEN** the unknown cache filter is selected
- **THEN** only the request with missing usage is displayed and exported
- **AND** headline metrics retain the full selected scope

### Requirement: Complete bounded dataset loading
The server SHALL compute cache summaries across retained request logs using SQL aggregation without downloading all records. Eligible rows SHALL be successful normal requests with input tokens greater than zero and known nonnegative cached usage. Missing usage SHALL remain unknown. Each refresh SHALL capture fixed time bounds and a maximum inserted record ID. Summary, trend, detail pages and CSV export SHALL exclude records above that ID. Detail pagination SHALL use a requested-at/id keyset cursor with a bounded page size, not offset pagination. Visible-page polling SHALL refresh the summary and active page at 30-second intervals without loading other pages. CSV SHALL fetch successive cursor pages only on export, fail without downloading a partial file if a page fails, and SHALL not impose the former 100000-row report limit. Missing key attribution SHALL be labeled unassigned without guessing identity.

#### Scenario: Late-completing request
- **GIVEN** a summary and first page captured a maximum record ID
- **WHEN** an older-started request completes and is inserted later
- **THEN** it does not enter subsequent pages or export for the captured range
- **AND** existing rows are neither duplicated nor skipped because of that insert

#### Scenario: Large dataset
- **GIVEN** retained requests exceed 100000 rows
- **WHEN** cache analysis loads
- **THEN** SQL aggregation returns full-scope totals and only one bounded detail page is transferred

#### Scenario: Restricted key metadata
- **WHEN** a viewer without api_keys:read opens cache analysis
- **THEN** key IDs and names are absent from options and records
- **AND** specific-key filtering is rejected

#### Scenario: Dataset spans API pages
- **GIVEN** requests span two cursor API pages
- **WHEN** cache analysis loads
- **THEN** SQL totals include both pages while only the active page is downloaded
- **AND** an explicit CSV export retrieves both pages using the same captured range

### Requirement: Focused homepage and report destinations
The homepage SHALL show operational summary, quota availability and account pool status without a request table, request filters, column controls or conversation browsing. It SHALL not fetch request logs, request filter catalogs or conversations. Report navigation SHALL provide separate usage, cache analysis and request records destinations. Request records SHALL preserve status/error details, archive access, filtering, configurable columns and permission-gated conversation browsing.

#### Scenario: Homepage reads only overview data
- **WHEN** the operator opens /dashboard
- **THEN** overview and projection data load without request-log or conversation-list reads
- **AND** no request table or request filters appear

#### Scenario: Diagnostic records remain accessible
- **WHEN** the operator opens /reports/requests
- **THEN** request logs, filters and request detail actions are available under the existing permissions
