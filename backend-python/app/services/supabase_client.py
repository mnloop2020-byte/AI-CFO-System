from supabase import Client, create_client

from app.config.settings import (
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)
from app.security.request_context import get_request_context


def _require_supabase_url() -> str:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing. Add it to backend-python/.env")
    return SUPABASE_URL


def get_service_supabase_client() -> Client:
    """Return an unrestricted client for trusted background/admin work only."""
    url = _require_supabase_url()
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError(
            "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to backend-python/.env"
        )
    return create_client(url, SUPABASE_SERVICE_ROLE_KEY)


def get_supabase_client() -> Client:
    """Return a user-scoped client whose JWT is enforced by Supabase RLS."""
    context = get_request_context()
    url = _require_supabase_url()

    if not SUPABASE_PUBLISHABLE_KEY:
        raise ValueError(
            "SUPABASE_PUBLISHABLE_KEY is missing. Add the current project's "
            "publishable key to backend-python/.env"
        )

    client = create_client(url, SUPABASE_PUBLISHABLE_KEY)
    # PostgREST and Storage clients are initialized lazily. Replacing this
    # header before first use makes both execute as the verified user instead
    # of as service_role, so database and Storage RLS are applied.
    client.options.headers["Authorization"] = f"Bearer {context.access_token}"
    return client
