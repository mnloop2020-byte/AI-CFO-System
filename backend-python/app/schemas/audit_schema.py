from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SecurityAuditEventResponse(BaseModel):
    id: UUID
    actor_id: UUID | None = None
    entity_type: str
    entity_id: str | None = None
    operation: str
    changed_fields: list[str]
    created_at: datetime
