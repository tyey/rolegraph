"""Throwaway endpoints for the API-client spike (#19). Not for merging.

They exercise the OpenAPI shapes a real rolegraph API will use: enums, nullable
fields, datetimes, nested models, lists, path/query params, request bodies,
204 responses and FastAPI's 422 validation errors.
"""

from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api")


class ProcessState(StrEnum):
    active = "active"
    on_hold = "on_hold"
    closed = "closed"


class StepOut(BaseModel):
    id: UUID
    kind: str
    scheduled_at: datetime | None = None


class RoleCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    seniority: str | None = None
    salary_min: int | None = Field(default=None, ge=0)
    tags: list[str] = []


class RoleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    seniority: str | None = None


class RoleOut(RoleCreate):
    id: UUID
    created_at: datetime


class ProcessOut(BaseModel):
    id: UUID
    role_id: UUID
    state: ProcessState
    steps: list[StepOut]


_roles: dict[UUID, RoleOut] = {}


@router.get("/roles", tags=["roles"])
def list_roles(
    q: str | None = None, limit: int = Query(default=50, ge=1, le=200)
) -> list[RoleOut]:
    return list(_roles.values())[:limit]


@router.post("/roles", tags=["roles"], status_code=status.HTTP_201_CREATED)
def create_role(body: RoleCreate) -> RoleOut:
    role = RoleOut(id=uuid4(), created_at=datetime.now(UTC), **body.model_dump())
    _roles[role.id] = role
    return role


@router.get("/roles/{role_id}", tags=["roles"])
def get_role(role_id: UUID) -> RoleOut:
    if role_id not in _roles:
        raise HTTPException(status_code=404)
    return _roles[role_id]


@router.patch("/roles/{role_id}", tags=["roles"])
def update_role(role_id: UUID, body: RoleUpdate) -> RoleOut:
    role = get_role(role_id)
    updated = role.model_copy(update=body.model_dump(exclude_unset=True))
    _roles[role_id] = updated
    return updated


@router.delete("/roles/{role_id}", tags=["roles"], status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: UUID) -> None:
    _roles.pop(role_id, None)


@router.get("/roles/{role_id}/processes", tags=["processes"])
def list_processes(role_id: UUID, state: ProcessState | None = None) -> list[ProcessOut]:
    return []
