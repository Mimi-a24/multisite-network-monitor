from collections.abc import Mapping
from ipaddress import IPv4Address

from pydantic import BaseModel, Field, ValidationError


class ConfigError(Exception):
    def __init__(self, problems: list[str]):
        super().__init__("invalid configuration: " + "; ".join(problems))
        self.problems = problems


class Agency(BaseModel):
    id: str = Field(min_length=1)
    ip: IPv4Address


class Config(BaseModel):
    api_url: str
    api_key: str
    agencies: list[Agency] = Field(min_length=1)
    probe_interval_seconds: int = Field(default=10, gt=0)


def parse_agencies(raw: str) -> list[Agency]:
    """'saint-denis=10.20.0.11,saint-paul=10.20.0.12' -> [Agency, Agency]"""
    agencies = []
    for pair in filter(None, (p.strip() for p in raw.split(","))):
        agency_id, sep, ip = pair.partition("=")
        if not sep:
            raise ValueError(f"expected id=ip, got {pair!r}")
        agencies.append(Agency(id=agency_id.strip(), ip=ip.strip()))
    return agencies


def load_config(env: Mapping[str, str]) -> Config:
    """Reports every problem at once, like the TypeScript services."""
    required = {"API_URL": "api_url", "COLLECTOR_API_KEY": "api_key", "AGENCIES": "agencies"}
    problems = [
        f"{name} is required and must not be empty"
        for name in required
        if not env.get(name, "").strip()
    ]

    agencies: list[Agency] = []
    if env.get("AGENCIES", "").strip():
        try:
            agencies = parse_agencies(env["AGENCIES"])
        except (ValueError, ValidationError) as err:
            problems.append(f"AGENCIES is invalid: {err}")

    interval = env.get("PROBE_INTERVAL_SECONDS", "").strip() or "10"
    if problems:
        raise ConfigError(problems)

    try:
        return Config(
            api_url=env["API_URL"].strip(),
            api_key=env["COLLECTOR_API_KEY"].strip(),
            agencies=agencies,
            probe_interval_seconds=interval,
        )
    except ValidationError as err:
        raise ConfigError(
            [f"{'.'.join(map(str, e['loc']))} {e['msg']}" for e in err.errors()]
        ) from err
