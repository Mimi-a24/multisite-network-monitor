import asyncio
import statistics
import uuid
from datetime import UTC, datetime

from icmplib import async_ping

from .config import Agency
from .models import Measurement

PACKETS = 3
TIMEOUT_SECONDS = 1


def to_measurement(agency_id: str, rtts: list[float], measured_at: datetime) -> Measurement:
    """Success if at least one packet came back; latency is the median, so one slow reply
    doesn't skew it."""
    success = len(rtts) > 0
    return Measurement(
        id=uuid.uuid4(),
        agency_id=agency_id,
        measured_at=measured_at,
        success=success,
        rtt_ms=round(statistics.median(rtts), 2) if success else None,
    )


async def probe(agency: Agency) -> Measurement:
    measured_at = datetime.now(UTC)
    # privileged=False uses an unprivileged ICMP socket: no root, no NET_RAW needed.
    host = await async_ping(
        str(agency.ip), count=PACKETS, interval=0.2, timeout=TIMEOUT_SECONDS, privileged=False
    )
    return to_measurement(agency.id, host.rtts, measured_at)


async def probe_all(agencies: list[Agency]) -> list[Measurement]:
    """All branches in parallel: one dead branch doesn't delay the others."""
    return list(await asyncio.gather(*(probe(a) for a in agencies)))
