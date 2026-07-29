# Pilot Deployment: Vercel and Cloud Run

This is a deployment contract only. Creating resources and deploying remain
manual, approval-gated operations.

## Target

- Vercel project Root Directory: `frontend`
- Cloud Run region: start with `me-west1` and confirm latency to the existing
  Supabase project and the selected Upstash primary region before provisioning
- Cloud Run: 1 vCPU, 2 GiB, request-based billing, min 0, max 1, concurrency 8,
  port 8080, request timeout 120 seconds
- Cloud Run startup/readiness path: `/health/ready`
- Cloud Run liveness path: `/health/live`
- Cloud Run ingress must allow browser invocation; FastAPI still enforces the
  Supabase Bearer token, company membership, MFA, permissions, and RLS

The Backend Docker image binds `0.0.0.0` and consumes Cloud Run's `PORT`.
Docker health checks consume the same dynamic port. Keep one Uvicorn worker per
container. The manual deployment gate uses `/health/ready` as its startup probe
and `/health/live` as its liveness probe, so a revision is not promoted while
required configuration or Upstash is unavailable.

## Runtime environment names

### Vercel

- `DEPLOYMENT_ENV`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Use `DEPLOYMENT_ENV=pilot`. Public URLs must be exact HTTPS origins. Do not add
Backend service credentials to Vercel. Preview deployments are not authorized
against the Pilot API unless their exact stable origin is explicitly reviewed
and added to CORS and Supabase redirect configuration.

### Cloud Run

- `APP_ENV`
- `PORT` (injected by Cloud Run)
- `UVICORN_LIMIT_CONCURRENCY`
- `CORS_ALLOWED_ORIGINS`
- `RATE_LIMIT_BACKEND`
- `RATE_LIMIT_REDIS_URL`
- `METRICS_BEARER_TOKEN`
- `FORWARDED_ALLOW_IPS`
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `LLM_MODEL`
- `LLM_TIMEOUT_SECONDS`
- `LLM_MAX_RETRIES`
- `CHAT_MAX_MESSAGE_CHARS`
- `CHAT_MAX_HISTORY_MESSAGES`
- `CHAT_MAX_HISTORY_CHARS`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EMBEDDING_MODEL`
- `RAG_MATCH_COUNT`
- `RAG_MIN_SIMILARITY`
- `RAG_DOCUMENT_BUCKET`
- `RAG_MAX_FILE_SIZE_BYTES`
- `RAG_MAX_CONTEXT_CHARS`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_USE_TLS`
- `SMTP_TIMEOUT_SECONDS`

Set `APP_ENV=pilot`, `RATE_LIMIT_BACKEND=redis`, and use the Upstash TLS Redis
connection string (`rediss://`) as `RATE_LIMIT_REDIS_URL`. The existing
`redis-py` client is connection-reused and does not use the Upstash REST
credentials. SMTP variables are optional until approved delivery is configured.

`DATABASE_URL` and `DIRECT_URL` are administration/migration variables, not
application runtime requirements. Do not inject them into Cloud Run.

## GitHub Pilot environment

Protect the GitHub environment named `pilot` with a required reviewer. The
manual workflow also requires `confirm_deploy=true`.

Repository/environment variables:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_ARTIFACT_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `PILOT_API_ORIGIN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

GitHub environment secrets:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `VERCEL_TOKEN`

Use Google Workload Identity Federation. Do not store a service-account JSON
key in GitHub. Application secrets stay in Google Secret Manager and must
already be attached to the Cloud Run service; the deployment workflow updates
only the reviewed image and runtime resource flags.

## One-time external gate

Before the first manual workflow run:

1. Create the Google project resources, Artifact Registry repository, least
   privilege runtime/deployer identities, Workload Identity Federation, Secret
   Manager bindings, and the Cloud Run service.
2. Attach all required application secret names to Cloud Run and set exact
   non-secret environment variables.
3. Verify the direct Cloud Run peer/proxy behavior and set
   `FORWARDED_ALLOW_IPS` only to the observed trusted proxy IP/CIDR. Never use
   `*`. Authenticated rate-limit buckets use a one-way token digest and never
   store or log the raw Bearer token.
4. Create/link the Vercel project with `frontend` as Root Directory and set its
   four public environment variables.
5. Add the final Vercel production callback/reset origins to Supabase Auth and
   set the exact Vercel origin in Backend CORS.
6. Select an Upstash primary region after measuring it against Cloud Run and
   Supabase; enable TLS and inject only the TLS Redis connection string.
7. Run the quality gate, scan the Backend image, verify `/health/live` and
   `/health/ready`, then conduct authenticated smoke tests before Pilot traffic.

No workflow changes Supabase schema or migration history.
