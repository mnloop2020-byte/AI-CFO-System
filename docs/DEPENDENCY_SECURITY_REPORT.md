# Dependency Security Report

Date: 2026-07-28  
Scope: Phase 2 only — frontend and backend dependency vulnerabilities  
Repository branch: `checkpoint/pre-single-company-auth-20260720`

## Executive summary

The initial frontend audit reported three HIGH vulnerability groups and no
CRITICAL vulnerabilities. They affected the direct `next` and `postcss`
dependencies and the transitive `sharp` dependency installed through Next.js.

The backend requirements resolved cleanly, but the existing development
environment contained a LOW PyTorch advisory and a MODERATE setuptools
advisory. Both were upgraded as defense-in-depth so that the final environment
audit is also clean.

After the updates:

- `npm audit`: 0 known vulnerabilities at every severity.
- `pip-audit --local`: 0 known vulnerabilities.
- `pip-audit -r requirements-dev.txt`: 0 known vulnerabilities.
- No database, migration, environment, or application-feature changes were
  made in this phase.

## Audit before remediation

### Frontend

| Dependency | Relationship | Installed version | Severity | Dependency path | Finding |
| --- | --- | ---: | --- | --- | --- |
| `next` | Direct | 15.5.19 | HIGH | `frontend -> next` | App Router Server Action denial of service and SSRF advisories, plus associated moderate findings |
| `postcss` | Direct | 8.5.15 | HIGH | `frontend -> postcss` | Attacker-controlled source-map path traversal/file disclosure |
| `postcss` | Transitive | 8.4.31 | HIGH | `frontend -> next -> postcss` | Same source-map disclosure class; the nested copy also required remediation |
| `sharp` | Transitive/optional | 0.34.5 | HIGH | `frontend -> next -> sharp` | Inherited vulnerable libvips image decoders |

Initial npm totals: 3 HIGH vulnerability groups, 0 CRITICAL, 3 total package
groups. npm groups multiple advisories under the affected package, so the
number of individual advisory records is greater than three.

### Backend

The requirements-file audit resolved to current safe releases and reported no
known vulnerabilities. The already-created local virtual environment reported
three records in two packages:

| Dependency | Relationship | Installed version | Severity | Dependency path | Finding |
| --- | --- | ---: | --- | --- | --- |
| `torch` | Transitive | 2.12.1 | LOW | `backend -> sentence-transformers -> torch` | Local `torch.jit.script` memory-corruption advisory; patched in 2.13.0 |
| `setuptools` | Development/build tooling | 81.0.0 | MODERATE | Python virtual-environment build tool | Unicode-normalization exclusion bypass while creating source distributions; patched in 83.0.0 |

`pip-audit` emitted the setuptools advisory twice under equivalent identifiers;
this was one underlying advisory, not two distinct vulnerabilities.

There were no HIGH or CRITICAL Python vulnerabilities.

## Updates applied

| Dependency | Before | After | Selection rationale |
| --- | ---: | ---: | --- |
| `next` | 15.5.19 | 15.5.21 | Smallest official Next.js 15 maintenance security release covering the reported July 2026 advisories |
| `postcss` | 8.5.15 direct / 8.4.31 nested | 8.5.18 everywhere | First release after the affected `<=8.5.17` range; an npm override prevents Next.js from retaining its vulnerable nested exact version |
| `sharp` | 0.34.5 | 0.35.3 | Current patched release recommended by the sharp advisory; override is needed because Next.js 15 still declares `^0.34.3` |
| `torch` | 2.12.1 | 2.13.0 | First patched release; compatible with Sentence Transformers' documented PyTorch requirement |
| `setuptools` | 81.0.0 | 83.0.0 | First patched build-tool release |
| `pip-audit` | Not recorded | 2.10.0 | Adds a reproducible development-only Python audit command |

The existing npm lock file was updated in place by `npm install`; it was not
deleted or recreated to hide findings.

## Compatibility and breaking-change review

### Next.js 15.5.21

This is a patch within the existing Next.js 15.5 maintenance line, not a major
framework migration. The official release contains the relevant security
fixes. No application API changes were required.

Reference:
https://github.com/vercel/next.js/releases/tag/v15.5.21

### PostCSS 8.5.18

The security change restricts loading previous source maps to the configured
`opts.from` directory. `unsafeMap: true` is available upstream as an opt-out,
but this project does not need or enable that unsafe behavior. The application
has no custom dependency on loading arbitrary previous source maps.

Reference:
https://github.com/postcss/postcss/releases/tag/8.5.18

### sharp 0.35.3

The 0.35 line drops Node.js 18 and requires Node.js 20.9 or newer, removes
deprecated APIs, changes several advanced image-processing options, and removes
the package install script. The audited environment runs Node.js 24.18.0, and
the project does not import sharp directly. Next.js production compilation and
all 24 application routes completed successfully with the override.

References:

- https://github.com/lovell/sharp/releases/tag/v0.35.0
- https://github.com/advisories/GHSA-f88m-g3jw-g9cj

### PyTorch 2.13.0

PyTorch 2.13 removes the deprecated named-tensor feature and changes advanced
distributed and build APIs. This project does not import PyTorch directly; it
uses the standard Sentence Transformers embedding interface. The import/tensor
smoke test and the full backend suite passed.

References:

- https://pytorch.org/blog/pytorch-2-13-release-blog/
- https://sbert.net/docs/installation.html
- https://github.com/advisories/GHSA-rrmf-rvhw-rf47

### setuptools 83.0.0

The patched version normalizes paths used by source-distribution manifest
matching. This is development/build tooling and does not change runtime
application behavior.

Reference:
https://github.com/advisories/GHSA-h35f-9h28-mq5c

## Verification results

| Check | Result |
| --- | --- |
| Frontend full tests | 41 passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Next.js production build | Passed; 24 routes generated |
| Standalone ESLint | Not run: ESLint is not installed and adding a new lint stack would expand this phase |
| Backend full tests | 138 passed |
| Python compilation | Passed |
| `pip check` | Passed; no broken requirements |
| PyTorch/Sentence Transformers smoke test | Passed |
| Final `npm audit` | 0 vulnerabilities |
| Final local Python audit | 0 vulnerabilities |
| Final Python manifest audit | 0 vulnerabilities |

The Next.js build performed its built-in type-validity/build checks. The only
build messages were non-failing webpack cache serialization performance
warnings.

## Remaining vulnerabilities and mitigations

No known LOW, MODERATE, HIGH, or CRITICAL findings remain in the final npm or
pip audit results.

Operational constraints:

- Node.js must remain at 20.9.0 or newer because of sharp 0.35.
- The `sharp` override should be removed when the maintained Next.js line
  officially accepts sharp 0.35 or newer.
- Python requirements are not fully locked with hashes. This predates this
  phase; introducing a complete lock-and-hash workflow should be a separate,
  tested supply-chain task rather than an incidental security update.
- Dependency audits identify published package advisories; they do not replace
  static analysis, runtime hardening, or image/container scanning.

## Git diff summary for this phase

Dependency-specific tracked files:

- `frontend/package.json`
- `frontend/package-lock.json`
- `backend-python/requirements.txt`
- `backend-python/requirements-dev.txt`
- `docs/DEPENDENCY_SECURITY_REPORT.md` (new)

Dependency changes in the four tracked manifests/lock file are limited to the
versions, overrides, and audit-tool/security-floor entries described above.
The larger lock-file diff is caused primarily by sharp's platform-specific
optional binary packages.

`docs/PRODUCTION_REMEDIATION_BASELINE.md` remains a separate pre-existing
untracked document and is not part of this dependency remediation report.

No commit or push was performed.
