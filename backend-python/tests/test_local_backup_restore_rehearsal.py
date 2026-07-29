from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "local_backup_restore_rehearsal.py"
)
SPEC = importlib.util.spec_from_file_location("local_backup_restore_rehearsal", SCRIPT_PATH)
assert SPEC and SPEC.loader
rehearsal = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = rehearsal
SPEC.loader.exec_module(rehearsal)


@pytest.mark.parametrize(
    "value",
    [
        "db.example.com",
        "postgresql://remote.example.com/database",
        "supabase-db",
        "../supabase_db_project",
        "supabase_db_project;whoami",
    ],
)
def test_source_guard_rejects_remote_or_unsafe_values(value: str) -> None:
    with pytest.raises(ValueError):
        rehearsal.validate_container_name(value, source=True)


def test_source_guard_accepts_supabase_local_container() -> None:
    assert (
        rehearsal.validate_container_name(
            "supabase_db_zemam-core-agent",
            source=True,
        )
        == "supabase_db_zemam-core-agent"
    )


def test_table_signature_rejects_unsafe_identifier() -> None:
    with pytest.raises(ValueError):
        rehearsal.table_signature("container", "database", "public.users;drop")
