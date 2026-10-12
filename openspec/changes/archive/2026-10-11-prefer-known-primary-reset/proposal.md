## Why

Primary reset preference currently substitutes a weekly deadline when the short-window deadline is missing, and treats expired deadlines as imminent. This can start a different account instead of using an eligible short window about to reset.

## What Changes

- Rank known future primary deadlines ahead of missing or expired primary deadlines.
- Do not infer an unstarted window from zero usage or invent a deadline from weekly usage.
- Preserve account eligibility, explicit account policies, session ownership, and secondary-window behavior.

## Impact

- Account-routing selector, regression tests, and routing documentation.
