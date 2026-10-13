# Design

## Context
See proposal.md for motivation and context.md for examples and constraints. Retained request logs contain the usage and key attribution needed for this change. The existing generic request-log API remains compatible with diagnostic clients.

## Goals / Non-Goals
Goals: bounded browser transfers, stable insertion-boundary pagination, explicit key scopes and independent headline metrics. No external monitoring platform, new settings, additional log storage or schema migration is required.

## Decisions
- Add SQL aggregate and cursor detail endpoints under the request-log module, rather than continuing client-side full-history aggregation. This preserves existing authentication and log-to-entry mapping while avoiding transfer of the entire retained history.
- Capture a maximum inserted ID and time bounds with each summary. Use requested-at/id keysets instead of offsets, so later inserted old-started completions cannot shift page boundaries. Tokens carry validated fields and are not credentials; key permissions are checked again on detail reads.
- Keep model/key/search/time in the summary scope; apply hit/miss/unknown only to records and CSV. Explicit assigned/all/unassigned/key scopes prevent historical null attribution from silently diluting per-key interpretation.
- Export on demand using successive cursor pages and CSV chunks. Fail on incomplete results, changed counts, repeated cursors or failed pages rather than downloading partial data.

## Risks / Trade-offs
- Retention or corrections can change existing rows: the insertion boundary is not a durable database snapshot. CSV completeness checks expose count changes and incomplete downloads.
- SQL totals scan retained rows: this removes browser transfer overhead; aggregate rollups may be warranted for much larger retained histories later.
- CSV size consumes browser memory: chunks avoid retaining all structured RequestLog objects, while a final Blob still requires memory proportional to the file.

## Migration Plan
Build frontend assets and gracefully restart the existing local backend with its original configuration. No data or settings migration is needed. Reverting the application code and rebuilding restores the old endpoints/page; stored logs and keys remain unchanged.
