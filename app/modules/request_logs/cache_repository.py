from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.db.models import ApiKey, RequestLog

CacheScope = Literal["assigned", "all", "unassigned", "key"]
CacheState = Literal["all", "hit", "miss", "unknown"]


@dataclass(frozen=True, slots=True)
class CacheWindow:
    max_id: int
    since: datetime | None
    until: datetime
    scope: CacheScope
    api_key_id: str | None
    model: str | None
    search: str | None
    search_key_names: bool = False


@dataclass(frozen=True, slots=True)
class CacheTotals:
    input: int
    cached: int
    count: int
    hits: int
    total: int


@dataclass(frozen=True, slots=True)
class CacheRecords:
    logs: list[RequestLog]
    total: int
    has_more: bool


class CacheReportRepository:
    _session: AsyncSession

    async def cache_max_id(self) -> int:
        return int(await self._session.scalar(select(func.max(RequestLog.id))) or 0)

    def _cache_conditions(self, window: CacheWindow, *, facets: bool = False) -> list[ColumnElement[bool]]:
        conditions = [
            RequestLog.id <= window.max_id,
            RequestLog.requested_at < window.until,
            RequestLog.deleted_at.is_(None),
        ]
        if window.since is not None:
            conditions.append(RequestLog.requested_at >= window.since)
        if facets:
            return conditions
        if window.scope == "assigned":
            conditions.append(RequestLog.api_key_id.is_not(None))
        elif window.scope == "unassigned":
            conditions.append(RequestLog.api_key_id.is_(None))
        elif window.scope == "key":
            conditions.append(RequestLog.api_key_id == window.api_key_id)
        if window.model:
            conditions.append(RequestLog.model == window.model)
        if window.search:
            escaped = window.search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            pattern = f"%{escaped}%"
            search_conditions = [
                RequestLog.request_id.ilike(pattern, escape="\\"),
                RequestLog.model.ilike(pattern, escape="\\"),
            ]
            if window.search_key_names:
                search_conditions.append(
                    RequestLog.api_key_id.in_(
                        select(ApiKey.id).where(ApiKey.name.ilike(pattern, escape="\\")),
                    )
                )
            conditions.append(or_(*search_conditions))
        return conditions

    def _cache_known(self) -> ColumnElement[bool]:
        return and_(
            RequestLog.input_tokens > 0,
            RequestLog.cached_input_tokens.is_not(None),
            RequestLog.cached_input_tokens >= 0,
        )

    def _cache_eligible(self) -> ColumnElement[bool]:
        return and_(RequestLog.status == "success", RequestLog.request_kind == "normal", self._cache_known())

    async def cache_totals(self, window: CacheWindow) -> CacheTotals:
        eligible = self._cache_eligible()
        # OpenAI input usage includes cached input; clamp malformed provider counts
        # consistently with the existing diagnostic mapper.
        cached = case(
            (RequestLog.cached_input_tokens > RequestLog.input_tokens, RequestLog.input_tokens),
            else_=RequestLog.cached_input_tokens,
        )
        row = (
            await self._session.execute(
                select(
                    func.coalesce(func.sum(case((eligible, RequestLog.input_tokens), else_=0)), 0),
                    func.coalesce(func.sum(case((eligible, cached), else_=0)), 0),
                    func.count(case((eligible, 1))),
                    func.count(case((and_(eligible, cached > 0), 1))),
                    func.count(),
                ).where(*self._cache_conditions(window))
            )
        ).one()
        return CacheTotals(*(int(value) for value in row))

    async def cache_records(
        self,
        window: CacheWindow,
        *,
        state: CacheState,
        limit: int,
        before_at: datetime | None = None,
        before_id: int | None = None,
        eligible_only: bool = False,
    ) -> CacheRecords:
        conditions = self._cache_conditions(window)
        if eligible_only:
            conditions.append(self._cache_eligible())
        if state == "hit":
            conditions.append(and_(self._cache_known(), RequestLog.cached_input_tokens > 0))
        elif state == "miss":
            conditions.append(and_(self._cache_known(), RequestLog.cached_input_tokens == 0))
        elif state == "unknown":
            conditions.append(
                or_(
                    RequestLog.input_tokens.is_(None),
                    RequestLog.input_tokens <= 0,
                    RequestLog.cached_input_tokens.is_(None),
                    RequestLog.cached_input_tokens < 0,
                )
            )
        total = (
            0
            if eligible_only
            else int(await self._session.scalar(select(func.count()).select_from(RequestLog).where(*conditions)) or 0)
        )
        if before_at is not None and before_id is not None:
            conditions.append(
                or_(
                    RequestLog.requested_at < before_at,
                    and_(RequestLog.requested_at == before_at, RequestLog.id < before_id),
                )
            )
        logs = list(
            (
                await self._session.scalars(
                    select(RequestLog)
                    .where(*conditions)
                    .order_by(RequestLog.requested_at.desc(), RequestLog.id.desc())
                    .limit(limit + 1)
                )
            ).all()
        )
        return CacheRecords(logs=logs[:limit], total=total, has_more=len(logs) > limit)

    async def cache_models(self, window: CacheWindow) -> list[str]:
        return list(
            (
                await self._session.scalars(
                    select(RequestLog.model)
                    .where(*self._cache_conditions(window, facets=True))
                    .distinct()
                    .order_by(RequestLog.model)
                )
            ).all()
        )

    async def cache_key_ids(self, window: CacheWindow) -> list[str]:
        values = list(
            (
                await self._session.scalars(
                    select(RequestLog.api_key_id)
                    .where(
                        *self._cache_conditions(window, facets=True),
                        RequestLog.api_key_id.is_not(None),
                    )
                    .distinct()
                    .order_by(RequestLog.api_key_id)
                )
            ).all()
        )

        return [value for value in values if value is not None]
