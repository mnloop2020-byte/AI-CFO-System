"""Rehearse an AI CFO database restore using local Docker containers only.

This tool intentionally accepts Docker container names instead of database URLs.
It refuses non-Supabase local database containers, starts the restore target
as a separate disposable local container, never prints row contents, and
deletes temporary artifacts unless an explicit artifact directory is supplied.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path


SAFE_CONTAINER = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$")
SAFE_TABLE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
SOURCE_PREFIX = "supabase_db_"
POSTGRES_IMAGE_PREFIX = "public.ecr.aws/supabase/postgres:"
RESTORE_DATABASE = "ai_cfo_restore_rehearsal"
PLATFORM_ROLES = ("supabase_functions_admin", "supabase_realtime_admin")
TABLE_SCHEMAS = ("public", "auth", "storage", "supabase_migrations")


@dataclass(frozen=True, slots=True)
class CommandResult:
    stdout: str


def run(*args: str, check: bool = True) -> CommandResult:
    completed = subprocess.run(
        args,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if check and completed.returncode != 0:
        detail = completed.stderr.strip() or "command failed"
        raise RuntimeError(f"{args[0]} failed: {detail}")
    return CommandResult(completed.stdout.strip())


def validate_container_name(value: str, *, source: bool = False) -> str:
    if not SAFE_CONTAINER.fullmatch(value):
        raise ValueError("Container names may contain only safe Docker name characters.")
    if source and not value.startswith(SOURCE_PREFIX):
        raise ValueError("The source must be a Supabase Local database container.")
    return value


def inspect_image(container: str) -> str:
    image = run("docker", "inspect", container, "--format", "{{.Config.Image}}").stdout
    if not image.startswith(POSTGRES_IMAGE_PREFIX):
        raise ValueError("The source is not a supported Supabase Local PostgreSQL image.")
    return image


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def psql(container: str, database: str, sql: str, *, user: str = "postgres") -> str:
    return run(
        "docker",
        "exec",
        container,
        "psql",
        "-X",
        "-U",
        user,
        "-d",
        database,
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
    ).stdout


def wait_for_postgres(container: str, attempts: int = 120) -> None:
    for _ in range(attempts):
        health = run(
            "docker",
            "inspect",
            container,
            "--format",
            "{{.State.Health.Status}}",
            check=False,
        ).stdout
        if health != "healthy":
            time.sleep(1)
            continue
        result = subprocess.run(
            ["docker", "exec", container, "pg_isready", "-U", "postgres", "-d", "postgres"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if result.returncode == 0:
            return
        time.sleep(1)
    raise RuntimeError("The isolated restore database did not become ready.")


def ensure_platform_roles(container: str) -> None:
    existing = set(
        psql(
            container,
            "postgres",
            "select rolname from pg_roles order by rolname;",
            user="supabase_admin",
        ).splitlines()
    )
    for role in PLATFORM_ROLES:
        if role not in existing:
            psql(
                container,
                "postgres",
                f'create role "{role}" nologin noinherit;',
                user="supabase_admin",
            )


def table_names(container: str, database: str) -> list[str]:
    schemas = ",".join(f"'{schema}'" for schema in TABLE_SCHEMAS)
    output = psql(
        container,
        database,
        (
            "select schemaname||'.'||tablename from pg_tables "
            f"where schemaname in ({schemas}) order by 1;"
        ),
    )
    names = [line for line in output.splitlines() if line]
    if any(not SAFE_TABLE.fullmatch(name) for name in names):
        raise RuntimeError("The database returned an unsafe table identifier.")
    return names


def table_signature(container: str, database: str, table: str) -> str:
    if not SAFE_TABLE.fullmatch(table):
        raise ValueError("Unsafe table identifier.")
    return psql(
        container,
        database,
        (
            "select count(*)::text||'|'||"
            "md5(coalesce(string_agg(row_hash,'' order by row_hash),'')) "
            f"from (select md5(to_jsonb(t)::text) row_hash from {table} t) rows;"
        ),
    )


CATALOG_QUERIES = {
    "columns": (
        "select md5(coalesce(string_agg(x,'|' order by x),'')) from "
        "(select table_schema||'.'||table_name||'.'||column_name||':'||"
        "data_type||':'||is_nullable||':'||coalesce(column_default,'') x "
        "from information_schema.columns where table_schema='public') q;"
    ),
    "constraints": (
        "select md5(coalesce(string_agg(x,'|' order by x),'')) from "
        "(select conname||':'||contype::text||':'||pg_get_constraintdef(oid) x "
        "from pg_constraint where connamespace='public'::regnamespace) q;"
    ),
    "indexes": (
        "select md5(coalesce(string_agg(indexname||':'||indexdef,'|' "
        "order by indexname,indexdef),'')) from pg_indexes where schemaname='public';"
    ),
    "policies": (
        "select md5(coalesce(string_agg(tablename||':'||policyname||':'||cmd||':'||"
        "roles::text||':'||coalesce(qual,'')||':'||coalesce(with_check,''),'|' "
        "order by tablename,policyname,cmd),'')) from pg_policies "
        "where schemaname='public';"
    ),
    "rls": (
        "select md5(coalesce(string_agg(c.relname||':'||c.relrowsecurity||':'||"
        "c.relforcerowsecurity,'|' order by c.relname),'')) from pg_class c "
        "join pg_namespace n on n.oid=c.relnamespace "
        "where n.nspname='public' and c.relkind='r';"
    ),
    "role_grants": (
        "select md5(coalesce(string_agg(table_name||':'||grantee||':'||"
        "privilege_type||':'||is_grantable,'|' order by table_name,grantee,"
        "privilege_type),'')) from information_schema.table_privileges "
        "where table_schema='public' and grantee not in ('postgres','supabase_admin');"
    ),
}


def create_dump(source: str, container_path: str) -> None:
    run(
        "docker",
        "exec",
        source,
        "pg_dump",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-Fc",
        "--no-owner",
        "--no-publications",
        "--no-subscriptions",
        "-N",
        "realtime",
        "-N",
        "_realtime",
        "--exclude-table-data=vault.secrets",
        "-f",
        container_path,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source-container",
        default="supabase_db_zemam-core-agent",
        help="Supabase Local database container.",
    )
    parser.add_argument(
        "--artifact-directory",
        type=Path,
        help="Optional restricted directory in which to retain the dump and manifest.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = validate_container_name(args.source_container, source=True)
    image = inspect_image(source)
    target = validate_container_name(f"ai-cfo-restore-rehearsal-{int(time.time())}")
    source_dump = f"/tmp/{target}.dump"
    started = time.monotonic()

    if args.artifact_directory:
        workdir = args.artifact_directory.resolve()
        workdir.mkdir(parents=True, exist_ok=False)
        temporary = None
    else:
        temporary = tempfile.TemporaryDirectory(prefix="ai-cfo-restore-")
        workdir = Path(temporary.name)

    dump_path = workdir / "database.dump"
    manifest_path = workdir / "manifest.json"
    target_started = False

    try:
        create_dump(source, source_dump)
        run("docker", "cp", f"{source}:{source_dump}", str(dump_path))
        run(
            "docker",
            "run",
            "-d",
            "--name",
            target,
            "-e",
            "POSTGRES_PASSWORD=local-rehearsal-only",
            image,
        )
        target_started = True
        wait_for_postgres(target)
        ensure_platform_roles(target)
        run(
            "docker",
            "exec",
            target,
            "createdb",
            "-U",
            "postgres",
            "-T",
            "template0",
            RESTORE_DATABASE,
        )
        run("docker", "cp", str(dump_path), f"{target}:/tmp/database.dump")
        run(
            "docker",
            "exec",
            target,
            "pg_restore",
            "-U",
            "supabase_admin",
            "-d",
            RESTORE_DATABASE,
            "--no-owner",
            "--exit-on-error",
            "/tmp/database.dump",
        )

        tables = table_names(source, "postgres")
        mismatches = [
            table
            for table in tables
            if table_signature(source, "postgres", table)
            != table_signature(target, RESTORE_DATABASE, table)
        ]
        catalogs = {
            name: (
                psql(source, "postgres", query)
                == psql(target, RESTORE_DATABASE, query)
            )
            for name, query in CATALOG_QUERIES.items()
        }
        bucket_summary = psql(
            source,
            "postgres",
            (
                "select json_build_object('buckets',count(*),'private',"
                "count(*) filter(where not public),'objects',"
                "(select count(*) from storage.objects))::text from storage.buckets;"
            ),
        )

        passed = not mismatches and all(catalogs.values())
        manifest = {
            "generated_at": datetime.now(UTC).isoformat(),
            "scope": "supabase-local-only",
            "source_image": image,
            "dump_sha256": sha256(dump_path),
            "tables_checked": len(tables),
            "table_mismatches": mismatches,
            "catalog_checks": catalogs,
            "storage_metadata": json.loads(bucket_summary),
            "vault_secret_rows_included": False,
            "realtime_platform_schemas_included": False,
            "elapsed_seconds": round(time.monotonic() - started, 3),
            "status": "passed" if passed else "failed",
        }
        manifest_path.write_text(
            json.dumps(manifest, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        print(json.dumps(manifest, indent=2, sort_keys=True))
        return 0 if passed else 1
    finally:
        run("docker", "exec", source, "rm", "-f", source_dump, check=False)
        if target_started:
            run("docker", "rm", "-f", target, check=False)
        if temporary is not None:
            temporary.cleanup()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError) as error:
        print(f"Restore rehearsal failed safely: {error}", file=sys.stderr)
        raise SystemExit(1) from error
