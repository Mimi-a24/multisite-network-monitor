import pytest

from collector.config import ConfigError, load_config

BASE = {
    "API_URL": "http://api:3000",
    "COLLECTOR_API_KEY": "secret",
    "AGENCIES": "saint-denis=10.20.0.11, saint-pierre=10.20.0.13",
}


def test_parses_agencies_and_defaults():
    config = load_config(BASE)
    assert [(a.id, str(a.ip)) for a in config.agencies] == [
        ("saint-denis", "10.20.0.11"),
        ("saint-pierre", "10.20.0.13"),
    ]
    assert config.probe_interval_seconds == 10


def test_blank_interval_falls_back_to_default():
    assert load_config({**BASE, "PROBE_INTERVAL_SECONDS": ""}).probe_interval_seconds == 10


def test_reports_every_missing_value_at_once():
    with pytest.raises(ConfigError) as err:
        load_config({"AGENCIES": " "})
    assert err.value.problems == [
        "API_URL is required and must not be empty",
        "COLLECTOR_API_KEY is required and must not be empty",
        "AGENCIES is required and must not be empty",
    ]


@pytest.mark.parametrize("agencies", ["saint-denis", "saint-denis=not-an-ip"])
def test_rejects_malformed_agencies(agencies):
    with pytest.raises(ConfigError):
        load_config({**BASE, "AGENCIES": agencies})


def test_rejects_non_positive_interval():
    with pytest.raises(ConfigError):
        load_config({**BASE, "PROBE_INTERVAL_SECONDS": "0"})
