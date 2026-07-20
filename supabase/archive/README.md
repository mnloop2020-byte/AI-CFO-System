# Archived Supabase migrations

Files in this directory are retained for audit history only. They are outside
`supabase/migrations` intentionally and must not be applied automatically.

`20260720120000_create_auth_and_tenant_isolation.sql` was never applied to the
remote project. It implements multi-company self-service sign-up and is not
compatible with the current **Single Company + Multiple Users** architecture.
Its content and SHA-256 hash were preserved unchanged when it was archived.
