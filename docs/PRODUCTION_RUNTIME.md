# Production Runtime

Last updated: 2026-07-29

This document defines the local runtime contract prepared for a future Pilot or
Production deployment. It does not authorize or perform deployment.

## Runtime topology

- Terminate TLS at a reviewed reverse proxy or managed ingress.
- Run the Frontend and Backend as separate non-root containers.
- Run exactly one Uvicorn worker per Backend container. Scale horizontally with
  additional containers so each replica exposes an independent metrics target.
- Use the managed TLS Redis service for shared rate limiting in `pilot` and
  `production`.
- Keep Supabase Storage buckets private and retain the existing RLS/RBAC model.

The reverse proxy must enforce request-size and connection limits, preserve the
original scheme and host, add HSTS only after the final HTTPS domain is
confirmed, and route only required public paths. `/internal/metrics` must be
reachable only by the monitoring collector and still requires its Bearer token.

## Trusted proxy configuration

`FORWARDED_ALLOW_IPS` is mandatory in `pilot` and `production`. Configure only
the exact proxy IP addresses or CIDRs that connect directly to Uvicorn. The
wildcard `*` is rejected. An incorrect trust range can allow a client to forge
its source IP and evade per-client rate limiting.

Example for a private ingress subnet:

```text
FORWARDED_ALLOW_IPS=10.20.0.0/24
```

The Backend production runner enables proxy-header processing, disables the
Uvicorn access log and identifying server/date headers, bounds concurrency, and
uses one process per container. Application logs remain structured and
redacted.

## Frontend build contract

Next.js public environment variables are embedded at build time. Build a
separate Frontend image for each environment with:

- `DEPLOYMENT_ENV=pilot` or `production`
- exact HTTPS `NEXT_PUBLIC_API_URL`
- exact HTTPS `NEXT_PUBLIC_SUPABASE_URL`
- the Supabase publishable key (never the Service Role key)

Deployed builds fail when either public origin is absent, non-HTTPS, or contains
credentials, a path, query, or fragment. CSP `connect-src` is generated from
those exact origins; wildcard Supabase hosts and implicit localhost access are
not allowed in deployed modes.

## Container controls

Both Dockerfiles run as unprivileged users and expose liveness checks. The
deployment platform should additionally enforce:

- read-only root filesystem where platform compatibility permits;
- a writable ephemeral `/tmp`;
- dropped Linux capabilities and `no-new-privileges`;
- CPU, memory, process, and request-body limits;
- image digest pinning after the release image is built and scanned;
- external secret injection with no secrets baked into image layers;
- rolling deployment with liveness/readiness checks and rollback ownership.

The Backend image installs the pinned CPU PyTorch build from PyTorch's official
CPU wheel index before resolving the application requirements. This prevents a
CPU-only RAG service from pulling the substantially larger CUDA runtime. The
image remains dependency-complete and should still be scanned and size-checked
before release.

## Local verification

```powershell
docker build --check -f backend-python/Dockerfile backend-python
docker build --check -f frontend/Dockerfile frontend

cd backend-python
& ".\.venv\Scripts\python.exe" -m pytest -q

cd ..\frontend
npm test
npx tsc --noEmit
npm run build
```

An actual target deployment still requires the domain, TLS ingress, managed
Redis, monitoring provider, external secrets, backup target, and human release
approval listed in `PRODUCTION_READINESS.md`.

## Local validation result

On 2026-07-29 both Dockerfiles passed `docker build --check` without warnings
and both images built successfully. The Frontend standalone image was
approximately 76 MB and returned `{"status":"ok"}` from `/api/health` as the
unprivileged `node` user. The Backend CPU image was approximately 459 MB and
returned `{"status":"ok"}` from `/health/live` as UID/GID `10001:10001`, with
`Cache-Control: no-store`.

The first Backend dependency resolution was intentionally stopped before
downloading a 526 MB GPU PyTorch wheel plus CUDA dependencies. The Dockerfile
was corrected to install the official pinned CPU wheel; the subsequent complete
image build and liveness check passed. These local tags are validation artifacts,
not signed or deployable release images.

The read-only GitHub Actions quality gate runs Backend tests/compilation/package
checks, Frontend tests/TypeScript/build/audit, and Dockerfile contract checks.
It uses only local placeholder configuration, declares no repository secrets,
and performs no deployment or Supabase operation.
