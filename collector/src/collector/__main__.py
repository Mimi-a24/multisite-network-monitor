import asyncio
import json
import logging
import os
import sys
import time

import httpx

from .client import ApiClient
from .config import Config, ConfigError, load_config
from .pinger import probe_all

log = logging.getLogger("collector")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {"level": record.levelname.lower(), "msg": record.getMessage(), "time": time.time()}
        entry.update(getattr(record, "fields", {}))
        return json.dumps(entry)


async def run(config: Config) -> None:
    headers = {"X-Api-Key": config.api_key}
    async with httpx.AsyncClient(base_url=config.api_url, headers=headers, timeout=5) as http:
        client = ApiClient(http)
        while True:
            started = time.monotonic()
            measurements = await probe_all(config.agencies)
            for m in measurements:
                log.info(
                    "probe",
                    extra={
                        "fields": {
                            "agency_id": m.agency_id,
                            "success": m.success,
                            "rtt_ms": m.rtt_ms,
                        }
                    },
                )
            await client.send(measurements)
            await asyncio.sleep(
                max(0.0, config.probe_interval_seconds - (time.monotonic() - started))
            )


def main() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler])
    logging.getLogger("httpx").setLevel(logging.WARNING)

    try:
        config = load_config(os.environ)
    except ConfigError as err:
        log.critical(str(err))
        sys.exit(1)

    log.info("collector started", extra={"fields": {"agencies": [a.id for a in config.agencies]}})
    asyncio.run(run(config))


if __name__ == "__main__":
    main()
