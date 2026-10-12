## ADDED Requirements

### Requirement: Known future primary deadlines precede unknown windows
Primary reset preference SHALL rank future primary deadlines first, in ascending order. Missing or expired deadlines SHALL rank last without secondary substitution or exclusion. Zero usage SHALL NOT prove an unstarted window. Account-policy, health, eligibility, and continuation precedence SHALL remain unchanged.

#### Scenario: Preserve an unused account with unknown primary timing
- **GIVEN** account A has available quota and a primary reset in twenty minutes
- **AND** account B has no primary deadline but a secondary reset in ten minutes
- **WHEN** otherwise comparable candidates are selected with primary reset preference
- **THEN** account A is selected

#### Scenario: Expired primary evidence is not an imminent window
- **GIVEN** account A has a future primary deadline
- **AND** account B has an expired primary deadline
- **WHEN** otherwise comparable candidates are selected with primary reset preference
- **THEN** account A is selected
