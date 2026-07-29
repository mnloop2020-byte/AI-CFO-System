# Backup and Restore Runbook

Last updated: 2026-07-29

## Scope and safety boundary

The automated rehearsal is for **Supabase Local only**. It accepts a local
Docker container name, never a database URL, verifies the Supabase PostgreSQL
image, and restores into a separate disposable local Docker container. It cannot
connect to the linked Supabase project.

Database backups contain sensitive Auth and company records. Production
artifacts must be encrypted, access-controlled, retained outside the source
environment, and must never be committed. Vault secret rows are deliberately
excluded and must be reprovisioned from the approved secret manager. Supabase
Realtime platform schemas are recreated by the target platform rather than
copied from the application database.

Private Storage requires two coordinated backups:

1. database metadata in `storage.buckets` and `storage.objects`;
2. the underlying object bytes, exported through the provider-supported
   Storage/S3 workflow with paths preserved.

A database dump alone does not recover object bytes.

## Local rehearsal command

From `backend-python`:

```powershell
.\.venv\Scripts\python.exe scripts\local_backup_restore_rehearsal.py
```

By default, the dump and manifest are held in an OS temporary directory and
removed after verification. To retain an artifact for an explicitly approved
encrypted test location:

```powershell
.\.venv\Scripts\python.exe scripts\local_backup_restore_rehearsal.py `
  --artifact-directory C:\restricted\ai-cfo-restore-rehearsal
```

Do not place the artifact directory inside the repository.

The tool verifies:

- row counts and order-independent row checksums for application, Auth,
  Storage-metadata, and migration-history tables;
- public columns, constraints, indexes, RLS flags, policies, and non-owner
  role grants;
- private bucket/object metadata counts;
- the SHA-256 digest of the dump.

## Production procedure

1. Freeze or record the backup consistency point and Git commit.
2. Create an encrypted provider-supported PostgreSQL backup.
3. Export private Storage object bytes and an inventory with SHA-256 digests.
4. Store the database dump, Storage export, migration list, sanitized manifest,
   and commit identifier in restricted backup storage.
5. Restore into a newly created isolated Supabase project in the same supported
   PostgreSQL region/version, never over the live project.
6. Reprovision secrets through the secret manager; do not restore old Vault
   secret rows blindly.
7. Restore Storage bytes to their exact private bucket paths.
8. Compare database checksums, object checksums, RLS/policies, role behavior,
   signed downloads, RAG citations, PDF downloads, and Action lifecycle.
9. Record elapsed time and evidence, then destroy the isolated environment
   under the approved retention policy.

## Pilot recovery objectives

- Proposed RPO: **24 hours** until automated backup frequency is approved.
- Proposed RTO: **4 hours** for database, Storage, secrets, and application
  validation.

These are operational targets, not provider guarantees. Production launch
requires the release owner to approve them against the selected Supabase plan,
Storage export method, data volume, and legal retention requirements.

## Rehearsal result — 2026-07-29

- Source: Supabase Local only; no remote database URL was used.
- Restore target: separate disposable local PostgreSQL container.
- PostgreSQL image: same Supabase PostgreSQL image as the source.
- Tables compared: **53**.
- Row-count/checksum mismatches: **0**.
- Columns, constraints, indexes, RLS flags, policies, and application role
  grants: **matched**.
- Storage metadata: **3 private buckets**, **0 objects**.
- Core local records included Customers, Sales, Expenses, Inventory, Invoices,
  company memberships/invitations, and security audit events.
- Object-byte restore could not be substantively exercised because the local
  Storage volume contained no objects. It remains a target-environment gate.
- The first diagnostic full-platform restore was rejected inside the disposable
  target by a managed Realtime function. The final procedure correctly excludes
  platform-managed Realtime schemas and Vault secret data.
- No Supabase remote write, migration, reset, commit, or push was performed.
