# Design context

Raw retained request logs remain the source of truth. Two cache-specific read endpoints separate full SQL aggregate metrics from bounded detail transfers. No model migration, scheduled background job or second copy of logs is introduced.

The default scope is assigned keys, rather than guessing which key owns historical null attribution. Operators may explicitly choose all traffic, unassigned traffic or a specific key. Viewers without key-read permission receive no key identifiers/names and cannot filter a specific key or search key names.

State filters are a diagnostic lens for rows and CSV only. For example, input/cache counts 1000/800 and 100/0 produce 72.7% coverage and a 50% request hit rate even while only hit rows are displayed.

Each summary carries fixed since/until bounds and an inserted-ID high-water mark. Rows order by (requested_at DESC, id DESC); continuation uses strictly smaller tuples and the same ID ceiling. This prevents later-inserted, older-started completions from shifting pages. Tokens carry validated filter/window fields and are not authorization credentials; permissions are rechecked on every read. This is an insertion boundary, not a durable MVCC snapshot: existing-row corrections, deletion and retention may change the underlying records. Export rejects incomplete/count-changing results instead of silently downloading them.

Polling returns SQL totals, up to 40 trend rows and only the active 15-row detail page. CSV is an explicit operation fetching 1000-row cursor pages and accumulating CSV string chunks, not all RequestLog objects. Browser memory still grows with the final CSV size; there is no arbitrary row ceiling. SQL aggregation scans retained rows, so very large histories may eventually warrant rollup support; this change avoids transferring that history to browsers.
