from __future__ import annotations

import base64
import binascii
from datetime import datetime
from typing import TypeVar

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.utils.time import to_utc_naive
from app.modules.request_logs.cache_repository import CacheScope
from app.modules.request_logs.schemas import RequestLogApiKeyOption, RequestLogEntry
from app.modules.shared.schemas import DashboardModel


class CacheSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    max_id: int = Field(ge=0, le=2**63 - 1)
    since: datetime | None
    until: datetime
    scope: CacheScope
    api_key_id: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=200)
    search: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def validate_scope(self) -> CacheSnapshot:
        if (self.scope == "key") != bool(self.api_key_id):
            raise ValueError("key scope requires exactly one API key")
        if self.since is not None and to_utc_naive(self.since) >= to_utc_naive(self.until):
            raise ValueError("invalid time range")
        return self


class CacheCursor(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requested_at: datetime
    id: int = Field(gt=0, le=2**63 - 1)


TokenModel = TypeVar("TokenModel", bound=BaseModel)


def encode_cache_token(value: BaseModel) -> str:
    return base64.urlsafe_b64encode(value.model_dump_json().encode()).decode().rstrip("=")


def decode_cache_token(value: str, schema: type[TokenModel]) -> TokenModel:
    try:
        raw = base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
        return schema.model_validate_json(raw)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("invalid cache pagination token") from exc


class CacheSummary(DashboardModel):
    input: int
    cached: int
    count: int
    hits: int
    total: int
    percent: float | None


class CacheSummaryResponse(DashboardModel):
    snapshot: str
    captured_at: datetime
    since: datetime | None
    scope: CacheScope
    summary: CacheSummary
    trend: list[RequestLogEntry]
    models: list[str]
    api_keys: list[RequestLogApiKeyOption]


class CacheRecordsResponse(DashboardModel):
    requests: list[RequestLogEntry]
    total: int
    next_cursor: str | None
