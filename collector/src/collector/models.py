from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class Measurement(BaseModel):
    """One probe result. Same shape as the zod contract in shared/src/contracts/measurement.ts."""

    id: UUID
    agency_id: str
    measured_at: datetime
    success: bool
    rtt_ms: float | None
