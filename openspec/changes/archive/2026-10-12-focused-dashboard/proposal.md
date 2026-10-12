# Focused dashboard

## Why
The homepage repeats detailed request records already available in reports. Operational overview and detailed investigation need separate destinations.

## What Changes
- Homepage contains only operational summary, quota availability and account pool status.
- Move request logs, filters, column controls, errors, archive access and conversation browsing to /reports/requests.
- Report tabs own usage, cache and diagnostic records; homepage offers a concise report link.
- Homepage stops polling request logs and conversation lists.

## Impact
Frontend presentation/routes only. Preserve all existing diagnostic capabilities and permission checks.
