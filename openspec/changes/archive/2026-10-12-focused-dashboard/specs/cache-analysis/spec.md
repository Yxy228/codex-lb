## ADDED Requirements

### Requirement: Focused homepage and report destinations
The homepage SHALL show operational summary, quota availability and account pool status without a request table, request filters, column controls or conversation browsing. It SHALL not fetch request logs, request filter catalogs or conversations. Report navigation SHALL provide separate usage, cache analysis and request records destinations. Request records SHALL preserve status/error details, archive access, filtering, configurable columns and permission-gated conversation browsing.

#### Scenario: Homepage reads only overview data
- **WHEN** the operator opens /dashboard
- **THEN** overview and projection data load without request-log or conversation-list reads
- **AND** no request table or request filters appear

#### Scenario: Diagnostic records remain accessible
- **WHEN** the operator opens /reports/requests
- **THEN** request logs, filters and request detail actions are available under the existing permissions
