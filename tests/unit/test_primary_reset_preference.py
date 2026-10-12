import pytest

from app.core.balancer.logic import AccountState, select_account
from app.db.models import AccountStatus

NOW = 2_000_000_000


@pytest.mark.parametrize("strategy", ["capacity_weighted", "fill_first", "usage_weighted"])
@pytest.mark.parametrize("deadline", [None, NOW - 60, NOW, NOW + 18000])
def test_known_imminent_primary_wins_over_unknown_expired_or_later(strategy, deadline):
    a = AccountState("a", AccountStatus.ACTIVE, used_percent=60, primary_reset_at=NOW + 1200, secondary_used_percent=30)
    b = AccountState(
        "b",
        AccountStatus.ACTIVE,
        used_percent=0,
        primary_reset_at=deadline,
        secondary_reset_at=NOW + 600,
        secondary_used_percent=0,
    )
    result = select_account(
        [a, b], now=NOW, routing_strategy=strategy, prefer_earlier_reset=True, prefer_earlier_reset_window="primary"
    )
    assert result.account.account_id == "a"


@pytest.mark.parametrize("case", ["burn_first", "cooldown", "disabled", "all_unknown"])
def test_primary_preference_preserves_other_selection_rules(case):
    a = AccountState("a", AccountStatus.ACTIVE, used_percent=60, primary_reset_at=NOW + 1200, secondary_used_percent=30)
    b = AccountState("b", AccountStatus.ACTIVE, used_percent=0, secondary_reset_at=NOW + 600, secondary_used_percent=0)
    if case == "burn_first":
        b.routing_policy = "burn_first"
    elif case == "cooldown":
        a.cooldown_until = NOW + 60
    elif case == "all_unknown":
        a.primary_reset_at = None
    result = select_account(
        [a, b],
        now=NOW,
        routing_strategy="usage_weighted",
        prefer_earlier_reset=case != "disabled",
        prefer_earlier_reset_window="primary",
    )
    assert result.account.account_id == "b"
