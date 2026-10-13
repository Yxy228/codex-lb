# Scalable cache monitoring

## Why
The cache page mixes unattributed historical traffic with keys, lets cache-state filters distort headline hit rates, and repeatedly downloads the complete raw history using unstable offset pagination.

## What changes
- Default to assigned-key traffic; offer explicit all/unassigned/key scopes.
- Aggregate eligible successful normal requests in SQL and keep cache-state filters confined to detail rows and export.
- Fetch bounded details using a requested-at/id cursor and a fixed maximum inserted ID plus time bounds shared by summary, trend, pages and export.
- Poll only the summary and active detail page; stream CSV page-by-page on explicit export.

## Impact
Existing generic diagnostic-log APIs stay compatible. Add cache-specific endpoints under existing request-log permissions without new storage or database migration.
