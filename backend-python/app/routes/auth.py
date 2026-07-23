from __future__ import annotations

import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, field_validator

from app.security.authentication import require_authenticated_request, require_permission
from app.security.request_context import RequestContext
from app.services.supabase_client import (
    get_service_supabase_client,
    get_supabase_client,
)


router = APIRouter(prefix="/auth", tags=["auth"])

CompanyRole = Literal["owner", "admin", "accountant", "viewer"]
InvitableRole = Literal["admin", "accountant", "viewer"]

_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class AuthMeResponse(BaseModel):
    user_id: str
    email: str
    company_id: str
    company_name: str
    role: CompanyRole
    permissions: list[str]


class MemberResponse(BaseModel):
    user_id: str
    email: str
    role: CompanyRole
    created_at: str
    updated_at: str


class MemberRoleUpdate(BaseModel):
    role: CompanyRole


class InvitationCreate(BaseModel):
    email: str
    role: InvitableRole
    expires_in_hours: int = Field(default=72, ge=1, le=720)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if len(normalized) > 254 or not _EMAIL_PATTERN.fullmatch(normalized):
            raise ValueError("A valid email address is required.")
        return normalized


class InvitationResponse(BaseModel):
    id: str
    email: str
    role: InvitableRole
    status: Literal["pending", "claimed", "accepted", "revoked", "expired"]
    expires_at: str
    accepted_at: str | None = None
    created_at: str


class InvitationCreatedResponse(InvitationResponse):
    acceptance_path: str


def _serialize_invitation(row: dict[str, object]) -> InvitationResponse:
    return InvitationResponse(
        id=str(row["id"]),
        email=str(row["email"]),
        role=str(row["role"]),
        status=str(row["status"]),
        expires_at=str(row["expires_at"]),
        accepted_at=str(row["accepted_at"]) if row.get("accepted_at") else None,
        created_at=str(row["created_at"]),
    )


def _get_auth_user_email(user_id: str) -> str:
    response = get_service_supabase_client().auth.admin.get_user_by_id(user_id)
    user = response.user if response else None
    return str(user.email or "") if user else ""


def _authorize_member_role_change(
    *,
    actor: RequestContext,
    target_user_id: str,
    current_role: CompanyRole,
    requested_role: CompanyRole,
) -> None:
    """Apply member-management limits before the database safety trigger."""
    if target_user_id == actor.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change your own company role.",
        )

    if actor.company_role == "admin" and current_role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An admin cannot modify an owner.",
        )

    if actor.company_role != "owner" and requested_role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only an owner can assign the owner role.",
        )


def _authorize_member_removal(
    *,
    actor: RequestContext,
    target_user_id: str,
    current_role: CompanyRole,
) -> None:
    """Prevent self-removal and owner removal by an administrator."""
    if target_user_id == actor.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot remove your own company membership.",
        )

    if actor.company_role == "admin" and current_role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An admin cannot remove an owner.",
        )


def _get_company_member(company_id: str, user_id: str) -> dict[str, object]:
    response = (
        get_supabase_client()
        .table("company_members")
        .select("user_id,role,created_at,updated_at")
        .eq("company_id", company_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Company member not found.")
    return response.data[0]


@router.get("/me", response_model=AuthMeResponse)
async def get_authenticated_user(
    context: RequestContext = Depends(require_authenticated_request),
) -> AuthMeResponse:
    """Return identity, company, role, and database-backed permissions."""
    return AuthMeResponse(
        user_id=context.user_id,
        email=context.email,
        company_id=context.company_id,
        company_name=context.company_name,
        role=context.company_role,
        permissions=sorted(context.permissions),
    )


@router.get("/members", response_model=list[MemberResponse])
async def list_company_members(
    context: RequestContext = Depends(require_permission("members.read")),
) -> list[MemberResponse]:
    response = (
        get_supabase_client()
        .table("company_members")
        .select("user_id,role,created_at,updated_at")
        .eq("company_id", context.company_id)
        .order("created_at")
        .execute()
    )

    members: list[MemberResponse] = []
    for row in response.data or []:
        email = await run_in_threadpool(_get_auth_user_email, str(row["user_id"]))
        members.append(
            MemberResponse(
                user_id=str(row["user_id"]),
                email=email,
                role=str(row["role"]),
                created_at=str(row["created_at"]),
                updated_at=str(row["updated_at"]),
            )
        )
    return members


@router.patch("/members/{user_id}", response_model=MemberResponse)
async def update_company_member(
    user_id: str,
    payload: MemberRoleUpdate,
    context: RequestContext = Depends(require_permission("members.manage")),
) -> MemberResponse:
    current_member = _get_company_member(context.company_id, user_id)
    _authorize_member_role_change(
        actor=context,
        target_user_id=user_id,
        current_role=str(current_member["role"]),
        requested_role=payload.role,
    )

    try:
        response = (
            get_supabase_client()
            .table("company_members")
            .update({"role": payload.role})
            .eq("company_id", context.company_id)
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The member role could not be changed. The last owner is protected.",
        ) from error

    if not response.data:
        raise HTTPException(status_code=404, detail="Company member not found.")

    row = response.data[0]
    email = await run_in_threadpool(_get_auth_user_email, user_id)
    return MemberResponse(
        user_id=user_id,
        email=email,
        role=str(row["role"]),
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_company_member(
    user_id: str,
    context: RequestContext = Depends(require_permission("members.manage")),
) -> None:
    current_member = _get_company_member(context.company_id, user_id)
    _authorize_member_removal(
        actor=context,
        target_user_id=user_id,
        current_role=str(current_member["role"]),
    )

    try:
        response = (
            get_supabase_client()
            .table("company_members")
            .delete()
            .eq("company_id", context.company_id)
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The member could not be removed. The last owner is protected.",
        ) from error

    if not response.data:
        raise HTTPException(status_code=404, detail="Company member not found.")


@router.get("/invitations", response_model=list[InvitationResponse])
async def list_company_invitations(
    context: RequestContext = Depends(require_permission("members.read")),
) -> list[InvitationResponse]:
    response = (
        get_supabase_client()
        .table("company_invitations")
        .select("id,email,role,status,expires_at,accepted_at,created_at")
        .eq("company_id", context.company_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_serialize_invitation(row) for row in (response.data or [])]


@router.post(
    "/invitations",
    response_model=InvitationCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_company_invitation(
    payload: InvitationCreate,
    context: RequestContext = Depends(require_permission("members.invite")),
) -> InvitationCreatedResponse:
    client = get_supabase_client()
    now = datetime.now(timezone.utc)

    existing_response = (
        client.table("company_invitations")
        .select("id,status,expires_at")
        .eq("company_id", context.company_id)
        .ilike("email", payload.email)
        .in_("status", ["pending", "claimed"])
        .execute()
    )
    for existing in existing_response.data or []:
        expiry = datetime.fromisoformat(str(existing["expires_at"]).replace("Z", "+00:00"))
        if existing["status"] == "pending" and expiry <= now:
            (
                client.table("company_invitations")
                .update({"status": "expired"})
                .eq("id", str(existing["id"]))
                .execute()
            )
            continue
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active invitation already exists for this email.",
        )

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = now + timedelta(hours=payload.expires_in_hours)

    try:
        response = (
            client.table("company_invitations")
            .insert(
                {
                    "company_id": context.company_id,
                    "email": payload.email,
                    "role": payload.role,
                    "status": "pending",
                    "invited_by": context.user_id,
                    "expires_at": expires_at.isoformat(),
                    "token_hash": token_hash,
                }
            )
            .execute()
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The invitation could not be created.",
        ) from error

    if not response.data:
        raise HTTPException(status_code=503, detail="Invitation service unavailable.")

    invitation = _serialize_invitation(response.data[0])
    return InvitationCreatedResponse(
        **invitation.model_dump(),
        acceptance_path=f"/register#token={raw_token}",
    )


@router.post("/invitations/{invitation_id}/revoke", response_model=InvitationResponse)
async def revoke_company_invitation(
    invitation_id: str,
    context: RequestContext = Depends(require_permission("members.invite")),
) -> InvitationResponse:
    response = (
        get_supabase_client()
        .table("company_invitations")
        .update(
            {
                "status": "revoked",
                "revoked_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("company_id", context.company_id)
        .eq("id", invitation_id)
        .eq("status", "pending")
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Pending invitation not found.",
        )
    return _serialize_invitation(response.data[0])
