import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace

from collector import pinger
from collector.config import Agency

NOW = datetime(2026, 10, 20, 9, 41, tzinfo=UTC)


def test_success_uses_the_median_latency():
    m = pinger.to_measurement("saint-pierre", [10.0, 50.0, 12.0], NOW)
    assert m.success is True
    assert m.rtt_ms == 12.0


def test_one_reply_out_of_three_is_a_success():
    assert pinger.to_measurement("saint-pierre", [18.456], NOW).rtt_ms == 18.46


def test_no_reply_is_a_failure_without_latency():
    m = pinger.to_measurement("saint-pierre", [], NOW)
    assert m.success is False
    assert m.rtt_ms is None


def test_serialises_to_the_api_contract():
    body = pinger.to_measurement("saint-pierre", [], NOW).model_dump(mode="json")
    assert set(body) == {"id", "agency_id", "measured_at", "success", "rtt_ms"}
    assert body["measured_at"] == "2026-10-20T09:41:00Z"


def test_probe_all_pings_every_branch(monkeypatch):
    replies = {"10.20.0.11": [5.0, 6.0, 7.0], "10.20.0.13": []}

    async def fake_ping(address, **_kwargs):
        return SimpleNamespace(rtts=replies[address])

    monkeypatch.setattr(pinger, "async_ping", fake_ping)
    agencies = [
        Agency(id="saint-denis", ip="10.20.0.11"),
        Agency(id="saint-pierre", ip="10.20.0.13"),
    ]

    results = asyncio.run(pinger.probe_all(agencies))

    assert [(m.agency_id, m.success, m.rtt_ms) for m in results] == [
        ("saint-denis", True, 6.0),
        ("saint-pierre", False, None),
    ]
