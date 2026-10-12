# Dedicated cache analysis

Coverage measures reused input tokens, while the request hit fraction counts requests with any reused input. For 800/1000 and 0/100, coverage is 72.7% and request hits are 1/2. Summaries span the full filtered retained dataset, not the current display page.

The local installation has hundreds of records. Reuse existing sequential paginated reads (1000 records per page, capped at 100000); refresh only while visible. Larger installations should narrow the time range. No partial results are presented after failed loads. The time interval is fixed during a load; concurrent deletion is not a transactional snapshot.

Use /reports/cache to inherit the report permission and avoid expanding budgeted core navigation. Keep request logs focused with a link to analysis. Key identity follows server redaction, and unattributed historical requests stay unassigned.
