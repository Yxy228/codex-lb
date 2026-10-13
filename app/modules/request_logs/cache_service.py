from __future__ import annotations

from datetime import timedelta
from typing import Literal

from app.core.utils.time import to_utc_naive, utcnow
from app.db.models import RequestLog
from app.modules.request_logs.cache_repository import CacheScope, CacheState, CacheWindow
from app.modules.request_logs.cache_schemas import (
    CacheCursor,
    CacheRecordsResponse,
    CacheSnapshot,
    CacheSummary,
    CacheSummaryResponse,
    decode_cache_token,
    encode_cache_token,
)
from app.modules.request_logs.mappers import to_request_log_entry
from app.modules.request_logs.repository import RequestLogsRepository
from app.modules.request_logs.schemas import RequestLogApiKeyOption, RequestLogEntry


class CacheReportService:
    def __init__(
        self,
        repo: RequestLogsRepository,
        *,
        include_sensitive_metadata: bool,
        include_api_key_identity: bool,
    ) -> None:
        self._repo = repo
        self._sensitive = include_sensitive_metadata
        self._keys = include_api_key_identity

    def _window(self, snapshot: CacheSnapshot) -> CacheWindow:
        if snapshot.scope == "key" and not self._keys:
            raise PermissionError("API key read permission required")
        return CacheWindow(
            max_id=snapshot.max_id,
            since=to_utc_naive(snapshot.since) if snapshot.since else None,
            until=to_utc_naive(snapshot.until),
            scope=snapshot.scope,
            api_key_id=snapshot.api_key_id,
            model=snapshot.model,
            search=snapshot.search,
            search_key_names=self._keys,
        )

    async def _entries(self, logs: list[RequestLog]) -> list[RequestLogEntry]:
        ids = [log.api_key_id for log in logs if log.api_key_id] if self._keys else []
        names = await self._repo.get_api_key_names_by_ids(ids) if ids else {}
        return [
            to_request_log_entry(
                log,
                api_key_name=names.get(log.api_key_id or ""),
                include_sensitive_metadata=self._sensitive,
                include_api_key_identity=self._keys,
            )
            for log in logs
        ]

    async def summary(
        self,
        *,
        timeframe: Literal["1h", "24h", "7d", "all"],
        scope: CacheScope,
        api_key_id: str | None,
        model: str | None,
        search: str | None,
    ) -> CacheSummaryResponse:
        now = utcnow()
        hours = {"1h": 1, "24h": 24, "7d": 168}
        snapshot = CacheSnapshot(
            max_id=await self._repo.cache_max_id(),
            until=now,
            since=now - timedelta(hours=hours[timeframe]) if timeframe != "all" else None,
            scope=scope,
            api_key_id=api_key_id,
            model=model,
            search=search,
        )
        window = self._window(snapshot)
        totals = await self._repo.cache_totals(window)
        recent = await self._repo.cache_records(window, state="all", limit=40, eligible_only=True)
        key_ids = await self._repo.cache_key_ids(window) if self._keys else []
        names = await self._repo.get_api_key_names_by_ids(key_ids) if key_ids else {}
        return CacheSummaryResponse(
            snapshot=encode_cache_token(snapshot),
            captured_at=now,
            since=snapshot.since,
            scope=scope,
            summary=CacheSummary(
                input=totals.input,
                cached=totals.cached,
                count=totals.count,
                hits=totals.hits,
                total=totals.total,
                percent=totals.cached / totals.input * 100 if totals.input else None,
            ),
            trend=await self._entries(recent.logs),
            models=await self._repo.cache_models(window),
            api_keys=[RequestLogApiKeyOption(id=key_id, name=names.get(key_id, key_id)) for key_id in key_ids],
        )

    async def records(
        self,
        *,
        snapshot_token: str,
        cursor_token: str | None,
        state: CacheState,
        limit: int,
    ) -> CacheRecordsResponse:
        snapshot = decode_cache_token(snapshot_token, CacheSnapshot)
        cursor = decode_cache_token(cursor_token, CacheCursor) if cursor_token else None
        if cursor and (
            cursor.id > snapshot.max_id or to_utc_naive(cursor.requested_at) >= to_utc_naive(snapshot.until)
        ):
            raise ValueError("cursor exceeds captured range")
        result = await self._repo.cache_records(
            self._window(snapshot),
            state=state,
            limit=limit,
            before_at=to_utc_naive(cursor.requested_at) if cursor else None,
            before_id=cursor.id if cursor else None,
        )
        last = result.logs[-1] if result.has_more else None
        return CacheRecordsResponse(
            requests=await self._entries(result.logs),
            total=result.total,
            next_cursor=encode_cache_token(CacheCursor(requested_at=last.requested_at, id=last.id)) if last else None,
        )
