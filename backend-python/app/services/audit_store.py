from app.schemas.audit_schema import SecurityAuditEventResponse
from app.services.supabase_client import get_supabase_client


def list_security_audit_events(limit: int = 100) -> list[SecurityAuditEventResponse]:
    response = (
        get_supabase_client()
        .table("security_audit_events")
        .select(
            "id,actor_id,entity_type,entity_id,operation,changed_fields,created_at"
        )
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [
        SecurityAuditEventResponse.model_validate(row)
        for row in (response.data or [])
    ]
