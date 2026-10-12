# Request cache report

## Why
Operators need to inspect cache effectiveness for every persisted request without manually querying SQLite.

## What Changes
- Display cached input tokens, input tokens, and their ratio in the request table and details.
- Summarize eligible successful normal requests on the current page.
- Export all matching retained request logs as CSV using existing authorized paginated APIs.

## Impact
Frontend only; no new persistence, routes, authentication settings, or database migrations.
