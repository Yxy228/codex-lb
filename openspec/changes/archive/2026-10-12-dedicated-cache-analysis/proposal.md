# Dedicated cache analysis page

## Why
The request log table mixes operational fields with cache metrics and is difficult to scan. Operators need a dedicated page with summaries for the full selected dataset.

## What Changes
- Create a responsive cache analysis page at /reports/cache with report navigation and a dashboard link.
- Move cache coverage, exact usage details and CSV export to that page.
- Show full-range weighted coverage, hit counts, recent-request chart, searchable/filterable paginated records and exact details.
- Reuse authorized request-log APIs and existing cache calculations; remove the added cache UI from the generic request table.

## Impact
Frontend routes and presentation only. No new database fields, backend routes or authentication changes.
