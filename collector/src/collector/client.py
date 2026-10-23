import logging
from collections import deque

import httpx

from .models import Measurement

log = logging.getLogger(__name__)

# Bounded: if the API is down for a long time, the oldest measurements are dropped
# instead of growing memory forever. Matches the API's maximum batch size.
BUFFER_SIZE = 1000


class ApiClient:
    """Sends measurements to the API. What can't be sent stays buffered and goes
    with the next cycle, so a short API outage loses nothing."""

    def __init__(self, http: httpx.AsyncClient):
        self._http = http
        self.pending: deque[Measurement] = deque(maxlen=BUFFER_SIZE)

    async def send(self, measurements: list[Measurement]) -> None:
        self.pending.extend(measurements)
        batch = list(self.pending)
        body = {"measurements": [m.model_dump(mode="json") for m in batch]}
        try:
            response = await self._http.post("/v1/measurements", json=body)
            response.raise_for_status()
        except httpx.HTTPStatusError as err:
            if err.response.status_code >= 500:
                log.warning("api error, keeping %d measurements", len(batch))
                return
            # 4xx: retrying the same batch would fail forever.
            log.error("batch rejected (%d): %s", err.response.status_code, err.response.text)
        except httpx.HTTPError as err:
            log.warning("api unreachable (%s), keeping %d measurements", err, len(batch))
            return
        self.pending.clear()
