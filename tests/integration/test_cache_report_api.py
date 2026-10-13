from __future__ import annotations

from datetime import timedelta

import pytest

from app.core.auth.dashboard_access import guest_principal
from app.core.auth.dependencies import validate_dashboard_session
from app.core.utils.time import utcnow
from app.db.models import ApiKey, RequestLog
from app.db.session import SessionLocal

pytestmark = pytest.mark.integration


async def seed_logs() -> None:
    async with SessionLocal() as session:
        session.add(ApiKey(id="cache-key", name="Self", key_hash="cache-test-hash", key_prefix="sk-test"))
        await session.flush()
        now = utcnow() - timedelta(minutes=1)
        for request_id, key, status, kind, tokens, cached in [
            ("hit", "cache-key", "success", "normal", 1000, 800),
            ("miss", "cache-key", "success", "normal", 100, 0),
            ("unknown", "cache-key", "cancelled", "normal", None, None),
            ("warmup", "cache-key", "success", "prewarm", 9000, 0),
            ("failed", "cache-key", "error", "normal", 200, 200),
            ("historical", None, "success", "normal", 10000, 10000),
        ]:
            session.add(
                RequestLog(
                    request_id=request_id,
                    api_key_id=key,
                    model="gpt-5.1",
                    requested_at=now,
                    status=status,
                    request_kind=kind,
                    input_tokens=tokens,
                    cached_input_tokens=cached,
                )
            )
        await session.commit()


@pytest.mark.asyncio
async def test_cache_summary_defaults_to_assigned_and_keeps_state_independent(async_client, db_setup):
    await seed_logs()
    response = await async_client.get("/api/request-logs/cache-summary")
    assert response.status_code == 200
    body = response.json()
    assert body["scope"] == "assigned"
    assert body["summary"] == {
        "input": 1100,
        "cached": 800,
        "count": 2,
        "hits": 1,
        "total": 5,
        "percent": 800 / 1100 * 100,
    }
    assert {row["requestId"] for row in body["trend"]} == {"hit", "miss"}
    assert body["apiKeys"] == [{"id": "cache-key", "name": "Self", "keyPrefix": None}]
    for state, expected in [("hit", {"hit", "failed"}), ("miss", {"miss", "warmup"}), ("unknown", {"unknown"})]:
        detail = await async_client.get(
            "/api/request-logs/cache-records", params={"snapshot": body["snapshot"], "state": state}
        )
        assert detail.status_code == 200
        assert {row["requestId"] for row in detail.json()["requests"]} == expected
    all_scope = (await async_client.get("/api/request-logs/cache-summary?scope=all")).json()
    assert all_scope["summary"]["input"] == 11100
    unassigned = (await async_client.get("/api/request-logs/cache-summary?scope=unassigned")).json()
    assert unassigned["summary"]["count"] == 1
    assert unassigned["summary"]["percent"] == 100


@pytest.mark.asyncio
async def test_cache_keyset_excludes_late_insert_and_handles_timestamp_ties(async_client, db_setup):
    await seed_logs()
    summary = (await async_client.get("/api/request-logs/cache-summary")).json()
    params = {"snapshot": summary["snapshot"], "limit": 2}
    first = (await async_client.get("/api/request-logs/cache-records", params=params)).json()
    assert len(first["requests"]) == 2
    async with SessionLocal() as session:
        session.add(
            RequestLog(
                request_id="late-completion",
                api_key_id="cache-key",
                model="gpt-5.1",
                requested_at=utcnow() - timedelta(hours=1),
                status="success",
                request_kind="normal",
                input_tokens=100,
                cached_input_tokens=100,
            )
        )
        await session.commit()
    ids = [row["requestId"] for row in first["requests"]]
    cursor = first["nextCursor"]
    while cursor:
        page = (await async_client.get("/api/request-logs/cache-records", params=params | {"cursor": cursor})).json()
        assert page["total"] == 5
        ids.extend(row["requestId"] for row in page["requests"])
        cursor = page["nextCursor"]
    assert len(ids) == len(set(ids)) == 5
    assert "late-completion" not in ids
    fresh = (await async_client.get("/api/request-logs/cache-summary")).json()
    assert fresh["summary"]["count"] == 3


@pytest.mark.asyncio
async def test_cache_filters_and_invalid_tokens(async_client, db_setup):
    await seed_logs()
    for query, expected in [
        ("scope=key&apiKeyId=cache-key&search=hit", 1),
        ("model=other", 0),
        ("search=%25", 0),
        ("search=Self", 2),
    ]:
        response = await async_client.get("/api/request-logs/cache-summary?" + query)
        assert response.status_code == 200
        assert response.json()["summary"]["count"] == expected
    for query in ["scope=key", "scope=all&apiKeyId=cache-key", "timeframe=invalid"]:
        assert (await async_client.get("/api/request-logs/cache-summary?" + query)).status_code == 422
    snapshot = (await async_client.get("/api/request-logs/cache-summary")).json()["snapshot"]
    for params in [
        {"snapshot": "bad-token"},
        {"snapshot": snapshot, "cursor": "bad-token"},
        {"snapshot": snapshot, "limit": 1001},
        {"snapshot": snapshot, "state": "invalid"},
    ]:
        assert (await async_client.get("/api/request-logs/cache-records", params=params)).status_code == 422


@pytest.mark.asyncio
async def test_cache_guest_cannot_read_or_filter_key_identity(async_client, db_setup, app_instance):
    await seed_logs()
    private_snapshot = (await async_client.get("/api/request-logs/cache-summary?scope=key&apiKeyId=cache-key")).json()[
        "snapshot"
    ]
    app_instance.dependency_overrides[validate_dashboard_session] = lambda: guest_principal()
    try:
        summary = (await async_client.get("/api/request-logs/cache-summary")).json()
        assert summary["apiKeys"] == []
        assert all(row["apiKeyId"] is None and row["apiKeyName"] is None for row in summary["trend"])
        records = (
            await async_client.get("/api/request-logs/cache-records", params={"snapshot": summary["snapshot"]})
        ).json()
        assert all(row["apiKeyId"] is None and row["apiKeyName"] is None for row in records["requests"])
        assert (
            await async_client.get("/api/request-logs/cache-summary?scope=key&apiKeyId=cache-key")
        ).status_code == 403
        assert (
            await async_client.get("/api/request-logs/cache-records", params={"snapshot": private_snapshot})
        ).status_code == 403
    finally:
        app_instance.dependency_overrides.pop(validate_dashboard_session, None)


@pytest.mark.asyncio
async def test_large_cache_dataset_uses_full_sql_totals_and_bounded_details(async_client, db_setup):
    from sqlalchemy import insert

    count = 100001
    async with SessionLocal() as session:
        session.add(ApiKey(id="large-key", name="Large", key_hash="large-test-hash", key_prefix="sk-large"))
        await session.flush()
        now = utcnow() - timedelta(minutes=1)
        for start in range(0, count, 5000):
            await session.execute(
                insert(RequestLog),
                [
                    {
                        "request_id": f"large-{index}",
                        "api_key_id": "large-key",
                        "model": "gpt-5.1",
                        "requested_at": now,
                        "status": "success",
                        "request_kind": "normal",
                        "input_tokens": 100,
                        "cached_input_tokens": 80,
                    }
                    for index in range(start, min(start + 5000, count))
                ],
            )
        await session.commit()
    response = await async_client.get("/api/request-logs/cache-summary")
    assert response.status_code == 200
    report = response.json()
    assert report["summary"]["count"] == count
    assert report["summary"]["input"] == count * 100
    assert report["summary"]["cached"] == count * 80
    assert len(report["trend"]) == 40
    page = (await async_client.get("/api/request-logs/cache-records", params={"snapshot": report["snapshot"]})).json()
    assert page["total"] == count
    assert len(page["requests"]) == 15
    assert page["nextCursor"] is not None
