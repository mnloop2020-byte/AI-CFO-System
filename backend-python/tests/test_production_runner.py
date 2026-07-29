from __future__ import annotations

import pytest

from scripts.run_production import bounded_integer


def test_production_runner_bounded_integer(monkeypatch) -> None:
    monkeypatch.setenv("PORT", "8080")
    assert bounded_integer("PORT", 8080, 1, 65535) == 8080


def test_production_runner_defaults_to_cloud_run_port(monkeypatch) -> None:
    monkeypatch.delenv("PORT", raising=False)
    assert bounded_integer("PORT", 8080, 1, 65535) == 8080


@pytest.mark.parametrize("value", ["zero", "0", "65536"])
def test_production_runner_rejects_invalid_port(monkeypatch, value: str) -> None:
    monkeypatch.setenv("PORT", value)
    with pytest.raises(RuntimeError):
        bounded_integer("PORT", 8080, 1, 65535)
