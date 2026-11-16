from app.security import DailyCap, RateLimiter


def test_rate_limit_window():
    t = [0.0]
    rl = RateLimiter(2, 60, clock=lambda: t[0])
    assert rl.allow("a") and rl.allow("a")
    assert not rl.allow("a")            # third call in the window
    assert rl.allow("b")                # another IP is separate
    t[0] = 61
    assert rl.allow("a")                # the window moved on


def test_daily_cap_and_reset():
    day = ["2026-10-23"]
    cap = DailyCap(2, today=lambda: day[0])
    assert cap.take() and cap.take()
    assert not cap.take()
    day[0] = "2026-10-24"
    assert cap.take()


def test_cap_zero_blocks_everything():
    assert DailyCap(0).take() is False


def test_code_ok():
    from app.security import code_ok
    assert code_ok(None, "") is True              # no code set: open
    assert code_ok("abc", "abc") is True
    assert code_ok("abd", "abc") is False
    assert code_ok(None, "abc") is False

