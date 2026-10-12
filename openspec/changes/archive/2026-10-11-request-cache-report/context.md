# Cache reporting

Cache coverage describes prompt/input reuse, not cached responses or measured latency savings. For example 800 cached tokens out of 1000 input tokens means 80% of input was reused. Unknown usage and synthetic warmups must not dilute normal-request summary coverage.

Existing request logs are the only source of truth. Export is limited to retained logs and uses the same authorization and identity redaction as the dashboard. A fixed since/until interval avoids new arrivals shifting pagination. This is not a transactional snapshot of concurrent deletions. Historical requests without key attribution remain unassigned; reporting does not change authentication or backfill identities. Existing customized column layouts can enable Cache through the column picker.
