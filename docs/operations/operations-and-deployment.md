# Operations, Deployment, Reliability and Cost Controls

Status: proposed operational design. Production hosting has **not** been selected.

## 1. Environments

- `local`: workstation PostgreSQL and NestJS, Vite dev server, Xcode simulator; synthetic data.
- `test`: automated integration database, isolated object bucket and fake payment verifier; no live banking.
- `staging`: production-like TLS/security and real iPhone device tests; fake payment references.
- `production`: approved domain, network exposure, backups, monitoring, legal/privacy policies and release gate.

Config via environment and secret manager; no production credentials in Git, shared static assets, frontend build vars or iOS binary.

## 2. Home/hybrid deployment requirements

```text
Public client
  -> HTTPS edge / Cloudflare Tunnel
  -> Caddy or API reverse proxy
  -> React static app + NestJS runtime
  -> internal PostgreSQL (no public ingress)
  -> private photo object store (cloud preferred for hybrid)
  -> encrypted off-site DB and configuration backups
```

A small 16–32 GB Linux mini PC may run a pilot, but sizing must follow measured active connections, image processing, storage capacity and concurrent uploads. Run dedicated low-privilege service accounts, database migrations out of band, OS and dependency patching, host firewall and separate management access. Verify residential ISP terms, dynamic IP/CGNAT behavior, upstream bandwidth, router security, UPS and power-outage handling.

Cloudflare Tunnel removes the need for inbound port forwarding but **does not** prevent outages of home power or ISP. If all components are home-hosted, expect single-site failure risk. A hybrid design with cloud primary object storage reduces home bandwidth demands.

## 3. Backups / recovery

- Daily encrypted PostgreSQL backups with regular transaction-log/WAL archival if low RPO is required.
- Off-site copies separate from production credentials, versioned/immutable when feasible.
- Protect inventory images and DB in a mutually consistent recovery strategy; document orphan handling.
- Restore into isolated environment **at least monthly** during pilot and after schema migrations.
- Suggested initial **targets to validate**: RPO 24 hours, RTO 24 hours for pilot; stricter customer commitments require different architecture.
- Keep a written runbook for SSD loss, ISP failure, corrupted migrations, ransomware and credential compromise.

## 4. CI/CD and release pipeline

Already scaffolded: GitHub Actions for TypeScript install/typecheck/build; add:
1. ESLint/format, unit tests, integration tests against Postgres with two tenants.
2. Prisma migration lint/validation and deployment dry-run with separate DB role.
3. Secret scanning, dependency/OS CVE scanning, basic SAST.
4. Swift iOS tests/build on macOS runner; signing certificates securely managed (not in repo).
5. Deploy staging → smoke/authorization checks → manual production approval → health test.
6. DB migrations: expand/contract patterns, backup before breaking changes.
7. Version web/API/mobile independently; backwards-compatible mobile API window.

## 5. Monitoring and incident response

Service metrics: uptime, HTTP status, route p50/p95/p99, DB connections, CPU/RAM, disk free space, media-upload failure rate, job queue depth, backup last-success/restore-test timestamp, login failures and suspicious enumeration. Business metrics: payment-verification backlog, subscription expirations, credit mismatches, revenue reconciliations, tenant bytes/downloads.

Logs: correlation ID, safe endpoint template, HTTP status, duration, build version, error code; **never customer inventory, QR label tokens, raw photos, proof screenshots, payment credentials or signed URLs**. Guard access and enforce retention.

Suggested **pilot** alert thresholds: disk <20% free, failed backup, API unavailable for >5 min, sustained 5xx >2%, elevated database connections, credit reconciliation discrepancy (immediate).

## 6. Capacity and cost management

Record tenant usage counters without reading customer content:
- `storage_bytes_used` and daily delta,
- container count vs plan limit,
- media download bytes and thumbnails generated,
- upload traffic and API-request counts,
- queue operation counts and error rates.

Use resizing/thumbnailing, delete retention, deduplicated variants (only within authorized tenant), short-lived media URLs, response caching that never leaks identity, and efficient DB indexes. Monitor actual usage and plan for burst traffic.

**Cost planning placeholders**, not vendor quotes:
- Managed GCP pilot: ~PHP 7,000/month.
- Lean home pilot: ~PHP 2,000/month in monthly expenses **plus hardware and possible extra ISP/failover costs**.
- Additional other OPEX scenario: PHP 15,000/month.
- Cost increase: 10% annually, while subscription prices remain PHP 999/1,999 for 2027–2029.

Avoid conflating direct cash hosting expenses with full economic operating cost (owner's time, manual verification, support, taxes and downtime).

## 7. Operational runbooks to add before launch

- Deploy and rollback.
- Scheduled backup/restore and disaster recovery drill.
- Rotating compromised secrets and revoked tokens.
- Approving/rejecting manual bank transfers, duplicate references and disputed receipts.
- Handling high-CPU/uploads and media delivery failures.
- Invoking access requests, data export, account deletion and privacy incident response.
- Domain/certificate renewal and Apple developer membership renewal.
- Public status/customer communications during outage.

## 8. SLO and launch gate

Aim for 99.5% initial monthly availability **only when measured**, not an implied contractual SLA. A paid launch requires demonstrated restoration, tenant-isolation tests, secure media handling, alert ownership, privacy/retention policy, and a suitable App Store classification.
