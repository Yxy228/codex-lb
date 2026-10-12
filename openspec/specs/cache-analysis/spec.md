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
The page SHALL support time range, model, API key when permitted, text search and cache hit/miss/unknown filters. Filters SHALL reset display pagination and apply equally to summaries, rows and export. The page SHALL fit a 390px viewport without document horizontal scrolling. API key controls SHALL be absent without api_keys:read permission.

#### Scenario: Missing usage filter
- **GIVEN** a completed cache miss and a cancelled request with missing usage
- **WHEN** the unknown cache filter is selected
- **THEN** only the request with missing usage is displayed and exported

### Requirement: Complete bounded dataset loading
Dataset loading SHALL use sequential authorized request-log pagination with a fixed since/until range and reject datasets exceeding 100000 rows. Failed or empty intermediate pages SHALL not produce a partial successful report. Visible-page polling SHALL refresh at 30-second intervals. Missing key attribution SHALL be labeled unassigned without guessing identity.

#### Scenario: Dataset spans API pages
- **GIVEN** requests span two API pages
- **WHEN** cache analysis loads
- **THEN** both pages contribute to the summary and the CSV export

### Requirement: Focused homepage and report destinations
The homepage SHALL show operational summary, quota availability and account pool status without a request table, request filters, column controls or conversation browsing. It SHALL not fetch request logs, request filter catalogs or conversations. Report navigation SHALL provide separate usage, cache analysis and request records destinations. Request records SHALL preserve status/error details, archive access, filtering, configurable columns and permission-gated conversation browsing.

#### Scenario: Homepage reads only overview data
- **WHEN** the operator opens /dashboard
- **THEN** overview and projection data load without request-log or conversation-list reads
- **AND** no request table or request filters appear

#### Scenario: Diagnostic records remain accessible
- **WHEN** the operator opens /reports/requests
- **THEN** request logs, filters and request detail actions are available under the existing permissions
