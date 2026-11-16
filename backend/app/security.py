import hmac
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone


def code_ok(given: str | None, expected: str) -> bool:
    """Compare the access code in constant time. No expected code means open access."""
    if not expected:
        return True
    return hmac.compare_digest((given or "").encode(), expected.encode())



class RateLimiter:
    """Allow at most max_calls per window_seconds for each key (for example, an IP address)."""

    def __init__(self, max_calls: int, window_seconds: float, clock=time.monotonic):
        self.max_calls, self.window, self.clock = max_calls, window_seconds, clock
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = threading.Lock()

    def allow(self, key: str) -> bool:
        with self.lock:
            now = self.clock()
            q = self.hits[key]
            while q and now - q[0] >= self.window:
                q.popleft()
            if len(q) >= self.max_calls:
                return False
            q.append(now)
            return True


class DailyCap:
    """A global limit on pipeline runs per UTC day. It protects your API budget."""

    def __init__(self, limit: int, today=None):
        self.limit = limit
        self._today = today or (lambda: datetime.now(timezone.utc).date())
        self._day = self._today()
        self._count = 0
        self.lock = threading.Lock()

    def take(self) -> bool:
        with self.lock:
            day = self._today()
            if day != self._day:
                self._day, self._count = day, 0
            if self._count >= self.limit:
                return False
            self._count += 1
            return True
