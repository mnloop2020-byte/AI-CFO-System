# Security and Recovery Operations

Last updated: 2026-07-22

## Security boundaries

- The deployed product is Single Company + Multiple Users. The backend derives the company from the verified membership and never accepts `company_id` from a browser payload.
- FastAPI financial endpoints require a Bearer access token. They do not authenticate with cookies, so browser CSRF does not authorize API writes. Supabase SSR cookies remain `SameSite`-protected and every redirect passes through the local-path allowlist.
- React escapes rendered values and `react-markdown` is used without raw-HTML support. The frontend adds CSP, frame, MIME-sniffing, referrer, and browser-permission headers.
- Uploaded documents and attachments remain private, signature-validated, size-limited, company-scoped, and available only through short-lived signed URLs.
- RAG chunks are wrapped as untrusted evidence. Instructions inside documents never change the system role or agent/tool permissions.
- Financial actions never send email, pay, order, or invoke an external financial service. Approval records only authorize the exact stored draft and expire after 24 hours.

## Agent capability boundaries

- Sales Agent: read verified sales/customer aggregates; no writes or external actions.
- Inventory Agent: read verified inventory; no purchase-order or vendor tool.
- Accounting, Cash Flow, Tax, Fraud, CEO, and Report Writer Agents: read deterministic server-built summaries; no direct database mutation.
- Document Agent: search only company-scoped ready RAG chunks and cite returned sources; document text cannot grant capabilities.
- Action Engine: read scoped financial records and create/update internal action drafts/events. External execution remains hard-disabled even after approval.
- No agent receives the Service Role key, raw access token, email-sending tool, payment tool, bank tool, or purchasing tool.

## Operational controls

- Request logs are structured JSON. UUIDs, emails, and Bearer tokens are redacted; request bodies, query strings, financial values, and document contents are not logged.
- LLM calls have bounded retries and timeouts. Only model/token usage and status are logged, never prompts or replies.
- Auth, Chat, Reports, Upload, and Action write routes use a Redis-backed shared
  limiter in deployed environments. The atomic fixed-window operation stores
  hashed client/route keys and fails closed if Redis is unavailable. Development
  and isolated tests may use the in-memory backend explicitly.
- `/health/live` confirms the process is running. `/health/ready` confirms required service configuration exists without returning secrets.
- `/internal/metrics` exposes only bounded operational labels and requires a
  dedicated backend-only Bearer token. It never emits user/company identifiers,
  financial values, prompts, responses, document names, or raw resource IDs.
- Owner/Admin can read immutable `security_audit_events`; event rows store operation, entity, actor, timestamp, and safe field names only.

## Backup procedure (non-destructive)

The executable local rehearsal and full production runbook are maintained in
`docs/BACKUP_RESTORE_RUNBOOK.md`.

1. Confirm the linked project reference is `tjadermimgzncdvfjpra`.
2. Create an encrypted logical database backup with the Supabase-supported backup workflow or `pg_dump` using a freshly obtained connection string. Never commit the dump or connection string.
3. Export private Storage bucket inventories (`documents`, `reports`, and `financial-attachments`) and copy objects into encrypted restricted backup storage.
4. Record counts for Companies, Members, Customers, Sales, Expenses, Inventory, Invoices, Conversations, Messages, Reports, Documents, Chunks, Attachments, Actions, Action Events, and Audit Events.
5. Store the migration history and the exact Git commit next to the encrypted backup manifest.

## Restore rehearsal

1. Restore into a new isolated Supabase test project, never over the live project.
2. Apply no new migrations until the restored migration history and schema have been compared.
3. Restore private Storage objects while preserving their exact bucket paths and privacy settings.
4. Run the verification SQL, RLS/role tests, signed-download tests, RAG source test, and Action Center lifecycle test.
5. Compare all protected counts and sample checksums with the backup manifest.
6. Destroy the isolated rehearsal project only after the results are documented.

On 2026-07-29, a database restore was completed against a separate disposable
local Docker target. All 53 compared table signatures and the
application schema/RLS/policy fingerprints matched. The local Storage buckets
were empty, so restoring real object bytes remains a target-environment gate.

## Incident response

- Revoke exposed credentials immediately in Supabase/OpenRouter, rotate ignored environment values, invalidate active sessions when required, and inspect security audit events plus sanitized request IDs.
- Do not paste keys, tokens, raw database URLs, customer data, financial values, or document content into tickets or chat.
- If row counts differ unexpectedly, stop writes and investigate. Do not run automatic repair, `DROP`, `TRUNCATE`, or bulk deletion.
