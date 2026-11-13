# Implementation Roadmap and Definition of Done

**Snapshot:** 2026-11-12 (Asia/Manila) · **Change:** [PR #4](https://github.com/ArgeeGabrielII/BoxVault/pull/4) · **Branch:** `feat/m1-auth-tenant-acl-rls`

> **M1 is not accepted for production, and PR #4 must remain unmerged until all applicable security release gates have independently verified evidence and explicit approval.** The repository is a developing scaffold, not an end-to-end customer-ready SaaS. A feature existing in code, a passing *earlier* CI run, or a successful isolated-database test is not proof of production readiness.

## Progress tracking rules

Use these statuses consistently. They track **delivery and evidence**, not a subjective percentage of security completeness.

| Status | Meaning | Counting rule |
|---|---|---|
| **Implemented** | Source/configuration or a scoped deliverable exists and its scope can be identified; may still require tests, integration, and review | Does **not** imply accepted, deployed, or production-safe |
| **In Progress** | Work is actively represented by partial implementation, an open design, or active integration work | Do not check off the acceptance gate |
| **Pending Verification** | The described capability/test is available or reported, but required proof, current-head CI, integration validation, or independent review is missing | Count as **unaccepted** |
| **Blocked** | A documented defect, unimplemented prerequisite, missing external dependency, or explicit release prohibition prevents completion | Count as **unaccepted**; record the unblock condition |

**Milestone completion rule:** Mark a milestone **Accepted** only when *every* defined gate has current, scoped evidence, required negative tests, security review, and an explicit sign-off. Only `[x]` items below denote narrow, evidence-backed results or verifiable scaffold existence; unchecked `[ ]` items are not accepted even if marked **Implemented**. Historical CI passes must be associated with their exact SHA and never rolled forward to a newer PR head without rerunning checks.

## Milestone progress dashboard

| Milestone | Delivery state | Verified progress / evidence | Acceptance state | Next decision or unblock |
|---|---|---|---|---|
| **M0 — Foundation** | **In Progress** | Monorepo, starter clients/API, Prisma baseline; CI and local tooling exist, but complete build/device/hosting gates remain | **Not accepted** | Verify full workspace, iOS on device, deployment choices |
| **M1 — Identity, MFA & tenant isolation** | **Blocked** for release; substantial **Implemented** backend work | Isolated Neon database phases **A/B/C verified**; scoped GitHub Actions passed at `deed36b8`; local real-provider register/verify/login was observed; full current-head/e2e acceptance outstanding | **0 production release approvals**; **not accepted** | Fix/diagnose own-tenant HTTP 403, rerun full matrix, review legacy privileged role, complete client integration and independent security approval |
| **M2 — Inventory, private media & QR/NFC** | **In Progress** (limited scaffold) | Initial native scanner and authenticated container-read foundation; full write/media/label flows not evidenced | **Not accepted** | Secure end-to-end inventory and label workflows with negative tests |
| **M3 — Web-only credits & subscriptions** | **Blocked** for financial release | Pricing/ledger model specified; payment-review endpoint intentionally not available for use | **Not accepted** | Implement double-entry/ledger integrity, bank verification, web-only entitlements and reconciliation |
| **M4 — Operations, compliance & pilot** | **Blocked** for launch | Isolated CI/test-branch evidence; no launch authorization or complete recovery/compliance evidence | **Not accepted** | Recovery drills, live operations controls, external review and legal/App Store sign-off |
| **M5 — V1 enhancements** | **Blocked** by MVP dependency | Backlog/design only | **Not accepted** | Finish accepted MVP before scheduling |

**Progress interpretation:** The three verified A/B/C database subphases are **test-environment deliverables**, not three completed production security gates. There is no defensible overall “% complete” yet. Report milestone counts only once the acceptance checklist and gate owners are baselined; a PR branch or a green CI badge must not be treated as launch readiness.

## Phase 0 — Foundation (M0)

| Work item | Status | Evidence / remaining condition |
|---|---|---|
| [x] Monorepo `apps/web`, `apps/api`, `apps/ios`, `packages/assets`, `packages/contracts` | **Implemented** | Repository layout exists |
| [x] React starter, NestJS `GET /api/v1/health`, preliminary Prisma schema, SwiftUI scanner | **Implemented** | Scaffold exists; not customer-ready |
| [ ] Workspace install/build, all CI jobs and Xcode physical-device validation on **current** source | **Pending Verification** | Scoped TypeScript CI previously passed; no full latest-head/device acceptance in the cited audit |
| [ ] Environment secrets, build/lint/test controls and deploy pipeline | **In Progress** | Non-secret env examples and CI jobs exist; production key management and delivery remain |
| [ ] Choose production home/hybrid hosting, private media store and recovery objectives | **Blocked** | Architecture and operational/security review required |

**Exit gate:** Reproducible environment setup, builds, secure secrets/configuration, test pipeline and approved infrastructure choices.

## Phase 1 — Identity, authorization and family privacy (M1 — security critical)

### Verified, scoped engineering evidence (not release acceptance)

- [x] **Database A — history adoption (isolated test branch):** Prisma `000`/`001` ledger entries verified with pre-existing tenant data retained. [Audit](../audit/database/phase-a-history-adoption.md).
- [x] **Database B — schema migrations:** `002`–`005` applied and inspected on `m1-security-test`; counts of existing inventory objects preserved. [Audit](../audit/database/phase-b-schema-deployment.md).
- [x] **Database C — restricted role privileges:** auth/content database role boundaries and onboarding function permissions verified on isolated Neon; **legacy privileged `boxvault_auth_m1` remains an open risk**. [Audit](../audit/database/phase-c-identity-grants.md).
- [x] **Historical scoped CI evidence:** general CI, M1 authorization, and PostgreSQL authorization jobs reported passing at commit `deed36b8` (2026-11-12). This is **not** a pass on today's PR head. [CI audit](../audit/platform/m1-ci-and-release-gates.md).
- [x] **Scoped real-provider exercise:** operator-reported local registration, Brevo verification and login with reCAPTCHA were supported by read-only Neon audit/membership checks; this is **not** a full production-grade auth sign-off. [Phase D audit](../audit/api/phase-d-real-provider-validation.md).

### Active implementation, verification and blockers

| Workstream / required outcome | Status | Evidence and next acceptance action |
|---|---|---|
| Argon2id login, Google token verification/linking, password reset, recipient-controlled verified-email onboarding | **Implemented** | NestJS auth services and migrations exist; retest negative cases/current PR head and real-provider edge cases |
| TOTP, one-time recovery, mandatory operator MFA/step-up, session refresh/reuse revocation, account audit | **Implemented** | Scoped backend implementation; verify fresh/current-head CI, race cases, key rotation, privileged-user controls |
| Tenant memberships, restricted database roles, private-by-default per-container ACL + RLS | **Implemented** | Verified scoped DB policy/grant results; full authenticated HTTP read/write/media/QR authorization still pending |
| **Browser tenant isolation: unauthenticated 401; unrelated tenant 403; own tenant 200** | **Blocked** | Reported 401/403/**403**; own-tenant access unexpectedly denied. The restricted-role DB test returned active membership and zero visible containers; **do not relax RLS**. Recheck logged-in principal and exact tenant UUID, then diagnose route binding and rerun |
| Existing family membership, invite acceptance/removal, four-person seat cap, ACL grant/revoke concurrency | **In Progress** | Schema/policy baseline exists; complete user-facing flows and transactional/HTTP race tests |
| Native/web signup, verification, Google login, MFA/recovery and logout UI | **Blocked** | Web is still a starter UI; iOS auth/security integration has no demonstrated end-to-end acceptance. [Web audit](../audit/web/m1-registration-ui.md) · [Mobile audit](../audit/mobile/m1-integration.md) |
| Complete real-provider validation (CAPTCHA freshness/replay, SMTP delivery/outbox, account recovery, safely handled verification links) | **Pending Verification** | Positive local flow reported; additional negative cases, delivery monitoring and token-log leakage controls remain |
| Full cross-tenant read/write/count/search/ACL/label/media HTTP matrix and latest-head CI | **Pending Verification** | Earlier scoped CI is evidence only for its recorded commit; exercise latest branch and capture run URLs |
| Retire/restrict legacy privileged auth role after dependency audit | **Blocked** | `boxvault_auth_m1` remains overprivileged on isolated test; separately authorize changes |
| Independent security review, branch protection, production OAuth/SMTP/CAPTCHA, edge/WAF, audit retention, backup/restore, rollback approval | **Blocked** | Required before merge/public launch; neither test-branch DB changes nor scoped CI waive these gates |

**M1 exit gate:** The authenticated principal and tenant are consistent at the real API boundary; permitted own/private/selected/all-family access succeeds, all unauthorized and revoked-member cases fail, and media/QR/finance boundaries are protected. Current-head full tests, live-provider and operations evidence, independent security sign-off and explicit approval are mandatory. **Do not merge PR #4 until the independently reviewed gate is satisfied.** See [M1 gate status](../security/m1-security-gate-status.md) and [engineering audit register](../audit/README.md).

## Phase 2 — Inventory, labels, private media and native scan (M2 — MVP)

| Work item | Status | Evidence / exit condition |
|---|---|---|
| [ ] Location hierarchy, container/item CRUD, quotas and search | **In Progress** | Models and limited authenticated container reads exist; complete write and search flows |
| [ ] Quick-overview photos, thumbnails, authorized upload/download and storage accounting | **Blocked** | Private object-store choice and authorization tests pending |
| [ ] Random QR labels and authorized resolve/rotation/revocation | **In Progress** | Design and SwiftUI scanner scaffold; no full secure resolution flow verified |
| [ ] React list/detail/search and native list/detail/camera/QR/NFC integration | **In Progress** | Scaffolds only, device integration not accepted |
| [ ] Read NFC NDEF / Universal Links on a physical iPhone | **Pending Verification** | Native device-level evidence required |

**M2 exit gate:** Create → photograph → label → scan → securely view works for owner and authorized members; outsider, revoked-user and bearer-label-only access are denied.

## Phase 3 — Credits and annual subscriptions (M3 — WEB ONLY)

| Work item | Status | Evidence / exit condition |
|---|---|---|
| [ ] Personal **PHP 999/year**, Family **PHP 1,999/year** (up to **4 total members**) | **Implemented** (design only) | Prices and unit model specified; actual subscriptions/entitlements not demonstrated |
| [ ] Web-only bank QR display, top-up and receipt/history workflow | **Blocked** | Web workflows and protected media/evidence handling pending |
| [ ] Independent admin transfer verification, approval/rejection and idempotent credit ledger | **Blocked** | Backend admin payment operation deliberately returns 501 even after guard; no live finance approval |
| [ ] Web-only redemption and API entitlement/expiry enforcement | **In Progress** (design) | Contract and planned schema; no accepted redemption workflow |
| [ ] Neutral read-only iOS plan/status, with **no purchasing or web payment links** | **Pending Verification** | Requires UI audit and Apple companion-app policy review |

**M3 exit gate:** A verified transfer is credited **at most once** under retries/races, financial writes are atomic and auditable, entitlement access is enforced, and iOS has no purchasing flow.

## Phase 4 — Operations, compliance, analytics and controlled pilot (M4)

| Work item | Status | Evidence / exit condition |
|---|---|---|
| [ ] Admin financial dashboard and privacy-safe reporting | **Blocked** | Payment workflow not accepted |
| [ ] Correlation IDs, privacy-safe observability, account audit archival and alerting | **In Progress** | Redacted account audit foundation exists; operational collection/retention not proven |
| [ ] Customer support workflow and consent-based win-back features | **Blocked** | Privacy/legal and product implementation pending |
| [ ] Production rate controls/WAF, secrets, key rotation, incident response, off-site backup and restore drill | **Blocked** | Scoped DB and CI tests are not operational acceptance |
| [ ] Philippine legal/tax/privacy terms and Apple companion-app review | **Blocked** | External compliance decision required before public paid service |
| [ ] Closed synthetic-data pilot followed by explicitly consented real-data pilot | **Blocked** | Release gates, support operations and recovery must be approved first |

**M4 exit gate:** Signed operational/security/legal gate, tested restore and incident response, controlled payment reconciliation, privacy compliance and launch authorization.

## Phase 5 — V1 enhancements (M5, after accepted MVP)

| Work item | Status | Notes |
|---|---|---|
| [ ] Native NFC tag writing, label rotation and bulk printing | **Blocked** | Requires accepted label/scanning foundation |
| [ ] Tenant ownership transfer, offline encrypted cache, export/import and bulk moves | **Blocked** | Later feature work |
| [ ] Payment reversal/disputes, receipts and expanded analytics | **Blocked** | Requires audited ledger MVP |
| [ ] Scalability/cost review using actual usage and throughput | **Pending Verification** | Needs post-pilot operational metrics |

**Family box-level PRIVATE / SELECTED_MEMBERS / ALL_FAMILY ACL is an M1/MVP security requirement, not an M5 enhancement.** See [family sharing](../product/family-sharing-access-control.md).

## Later ideas (not committed)

AI-assisted item suggestions, barcode scanning, Android, advanced zero-knowledge family encryption, optional business tiers, and automated gateways after appropriate registration. These are not scheduled or accepted scope.

## Engineering Definition of Done (every feature)

1. Feature ID mapped to approved requirement, owner, relevant PR/commit and automated/manual tests.
2. API DTO/OpenAPI updated; generated TypeScript/Swift clients are compatible where applicable.
3. Positive **and negative** tenant RBAC, per-object ACL and PostgreSQL RLS tests pass on the **current** source; independent HTTP test validates the actual server boundary.
4. Inputs, concurrency, replay, abuse, authorization errors, empty/loading states and accessibility are tested.
5. Sensitive-content-free audit, safe telemetry, retention, log redaction and security alerting are reviewed.
6. Credits, private media, quotas, idempotency and data migrations have appropriate failure/rollback tests.
7. Documentation, migration/rollback procedures and artifact/evidence links are updated and reviewed.
8. CI is green at the **current PR head**; real-device/client verification is attached when applicable.
9. Security owner explicitly signs off on required release gates; product launch remains independently approved.

## Release blockers — never automatically waived

- **Current M1 defect:** own-tenant browser request returned 403 instead of expected 200; tenant-binding diagnosis and retest pending.
- Insufficient current-head HTTP/DB/CI and independent security review, with incomplete media/QR/finance negative authorization coverage.
- Remaining overprivileged legacy test auth role; unverified operator provisioning, WAF, audit integrity, key rotation, and real-provider reliability.
- Cross-tenant leakage, private photo/object exposure, improper QR bearer-label access, unauthorized family sharing, removal/session-revocation weakness.
- Duplicate-credit races, operator inventory browsing, absent encrypted off-site backup and restore testing.
- Unreviewed Philippine registration/legal/privacy requirements or App Store restrictions on companion/payment features.

**Tracking sources:** [M1 security gates](../security/m1-security-gate-status.md) · [API implementation audit](../audit/api/m1-implementation.md) · [Phase D provider/HTTP evidence](../audit/api/phase-d-real-provider-validation.md) · [Platform CI audit](../audit/platform/m1-ci-and-release-gates.md) · [Security release checklist](../security/security-release-checklist.md).

**Review cadence:** Refresh each status when a new PR commit, provider/HTTP test, CI run, database change, or reviewer decision occurs. Record the new evidence and date; do not retroactively rewrite an old passing commit as current-head verification.
