# BoxVault documentation

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](architecture/aws-platform-decision.md) and [daily rotation policy](deployment/secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

**Current platform and delivery — 2026-11-19:** AWS is the primary SaaS platform in Sydney (RDS replaces Neon; SES replaces Brevo, with neither retained as an active fallback), with one API host, private Single-AZ RDS and daily credential rotation. Auto Scaling and Multi-AZ are deferred. Connected local auth/inventory/QR/Family source and scoped checks exist; the AWS toolkit is installed with read-only access. AWS application deployment, private uploads, complete payments and live rotation remain unfinished. Source/CI/tooling are not production acceptance. [Accepted platform decision](architecture/aws-platform-decision.md).

> **Source consolidation — 2026-11-13:** The owner authorized consolidating the development branches into `main`. Earlier branch-isolation and merge-hold notes are historical. Production security acceptance remains pending; the owner approved the mock `apps/web` dashboard as the Firebase Hosting input; backend services remain outside this deployment.

Mock materials are organized under [mock documentation](mock/README.md): [tester guides](mock/documents/README.md) and [test-data catalog](mock/data/README.md) are separate; the [runnable HTML](../mock/boxvault-m1-registration-harness.html) stays under `/mock`. Mock helpers are **not production API contracts**.

## Use the connected local app

Run `pnpm install --frozen-lockfile`, then `pnpm dev:local`, and open **http://127.0.0.1:5180**. Create an account, verify it in Local inbox, create boxes/items and download/test a real access-checked QR label. [Setup, connected features and limits](development/connected-local-app.md). Local data persists in `.boxvault-local`; the Firebase site remains a separate mock UI. Production acceptance is still pending.

## Primary AWS platform and migration

[Complete AWS service map and rollout plan](deployment/aws-service-map.md): core services, optional growth services, application feature ownership, security boundaries and cost decisions.

[AWS service mapping, cost/account discovery and migration runbook](deployment/aws-migration.md). Read-only Agent Toolkit access is installed; application infrastructure and data migration remain pending. [Toolkit setup and renewal](deployment/aws-agent-toolkit.md). Read-only CLI discovery: `pnpm aws:readiness --profile boxvault-restricted --region ap-southeast-2`.

## Start here

1. [Accepted AWS platform and daily-rotation decision](architecture/aws-platform-decision.md)
2. [Product requirements](product/product-requirements.md)
3. [Solution architecture](architecture/solution-architecture.md)
4. [Security-first standard](security/security-first-standard.md)
5. [M1 security gate status](security/m1-security-gate-status.md)
6. [Development workflow](development/development.md)
7. [Delivery roadmap](planning/delivery-roadmap.md)

## Documentation by category

### Product & Billing

| Document | Description |
|---|---|
| [product-requirements.md](product/product-requirements.md) | Product requirements, workflows and MVP scope |
| [family-sharing-access-control.md](product/family-sharing-access-control.md) | Private container sharing and family member ACL |
| [credits-and-subscriptions.md](product/credits-and-subscriptions.md) | Credits, annual plans and manual payment flow |

### Architecture & API

| Document | Description |
|---|---|
| [solution-architecture.md](architecture/solution-architecture.md) | Solution design and application boundaries |
| [architecture.md](architecture/architecture.md) | Current application and AWS boundaries |
| [aws-platform-decision.md](architecture/aws-platform-decision.md) | Accepted AWS platform, Single-AZ and daily rotation policy |
| [data-model.md](architecture/data-model.md) | Data model and tenant constraints |
| [api-contract.md](architecture/api-contract.md) | Proposed and M1 REST API contracts |

### Security & Privacy

| Document | Description |
|---|---|
| [security-first-standard.md](security/security-first-standard.md) | Mandatory SaaS security engineering standard |
| [security-and-privacy.md](security/security-and-privacy.md) | Threat model and data privacy |
| [authentication-google-mfa-captcha.md](security/authentication-google-mfa-captcha.md) | Google sign-in, MFA and CAPTCHA requirements |
| [security-release-checklist.md](security/security-release-checklist.md) | Production release gates |
| [critical-authorization-e2e-tests.md](security/critical-authorization-e2e-tests.md) | Critical authorization end-to-end test scope |
| [m1-authentication-implementation.md](security/m1-authentication-implementation.md) | Implemented M1 authentication features and limitations |
| [m1-authentication-hardening.md](security/m1-authentication-hardening.md) | M1 hardened flows and release blockers |
| [m1-token-bound-onboarding.md](security/m1-token-bound-onboarding.md) | Token-bound onboarding specification |
| [m1-security-gate-status.md](security/m1-security-gate-status.md) | Current M1 security verification and blockers |

### Experience

- [All-role sitemap, System Support and demo login routing](experience/role-sitemap.md).

- [Admin console UI preview](experience/admin-preview.md) — mock account/billing operations, review flows and QA.

| Document | Description |
|---|---|
| [web-experience-seo-compliance.md](experience/web-experience-seo-compliance.md) | SEO, accessibility, web UX and compliance |

### QR and Developer Playground

| Document | Description |
|---|---|
| [Developer Playground](developer-playground.md) | Local labs plus isolated public mock build |
| [QR implementation](qr-library-implementation.md) | QR package and verification |
| [QR architecture](qr-library-architecture.md) | Encoder architecture |

### Development & Integrations

| Document | Description |
|---|---|
| [development.md](development/development.md) | Local setup and developer workflow |
| [neon-connection.md](development/neon-connection.md) | Legacy isolated-Neon reference; not primary setup |
| [neon-agent-skills-mcp.md](development/neon-agent-skills-mcp.md) | Historical optional Neon tooling guidance |
| [m1-neon-free-tier-validation.md](development/m1-neon-free-tier-validation.md) | Free-tier and deployment validation |
| [m1-neon-reconciliation-audit-2026-11-12.md](development/m1-neon-reconciliation-audit-2026-11-12.md) | Neon reconciliation audit |

### Operations

| Document | Description |
|---|---|
| [operations-and-deployment.md](operations/operations-and-deployment.md) | Deployment, reliability, backup and cost controls |
| [AWS service map](deployment/aws-service-map.md) | Selected services and deferred growth scope |
| [AWS migration](deployment/aws-migration.md) | Fresh-database rollout and current evidence |
| [Daily rotation](deployment/secret-rotation.md) | Secret-class policy, safe refresh and acceptance |
| [AWS toolkit](deployment/aws-agent-toolkit.md) | Restricted access and credential renewal |
| [Firebase Spark deployment](firebase-spark-deployment-plan.md) | Superseded platform ADR; retained mock safeguards |
| [Firebase Spark CI/CD](firebase-spark-cicd.md) | Existing legacy mock preview pipeline until AWS cutover |

### Planning

| Document | Description |
|---|---|
| [delivery-roadmap.md](planning/delivery-roadmap.md) | Phased roadmap and acceptance criteria |
| [milestone-01-security-foundation.md](planning/milestone-01-security-foundation.md) | M1 security milestone scope |

### Mock Testing

| Document | Description |
|---|---|
| [docs/mock/README.md](mock/README.md) | Mock documentation index and separation policy |
| [documents/README.md](mock/documents/README.md) | Local tester usage, password reset, UUID auto-fill and fallback lookup |
| [container-sharing-revocation.md](mock/documents/container-sharing-revocation.md) | Owner-only container creation and grant/revocation test; same-tenant prerequisite |
| [data/README.md](mock/data/README.md) | Synthetic test data dictionary, fixture expectations and safety boundaries |

### Engineering Audit

| Document | Description |
|---|---|
| [AWS documentation reconciliation](audit/platform/aws-documentation-reconciliation-2026-11-19.md) | Reviewed document inventory, policy changes and validation boundaries |
| [ID-03 audit](audit/api/id03-family-membership.md) | Current family backend implementation, verification and release boundaries |
| [README.md](audit/README.md) | M1 phase-by-phase engineering audit register and evidence |

---

## Approved business decisions

- **Free User**: limited storage containers and advertisements; exact cap not yet specified.
- **Single User (Personal)**: **PHP 119/month** billed monthly or **PHP 999/year** billed annually (**Best Value**); one user.
- **Family User**: **PHP 219/month** billed monthly or **PHP 1,999/year** billed annually; up to **4 users total including the owner**.
- Target fixed customer-facing prices: **2027 through 2029**, subject to later business/legal review. Model expense inflation at **10% annually**; do not silently reprice an active term.
- Customers buy closed-loop, non-cash-redeemable software credits through the **React web app only**, via manual bank transfer to the owner's bank QR and receipt submission; authorized administrator independently verifies receipt.
- The **native iOS** app is for inventory, QR/NFC, and account/plan-status features only. **No purchases, pricing, credit top-ups, receipt submissions or external purchasing links/calls to action** in the iOS UI.
- Family sharing is **private by default per container**; owners explicitly grant access to selected family members or all active members. See [family-sharing-access-control.md](product/family-sharing-access-control.md).
- A subscription is owned by a **tenant** (individual or family), not a device. Family members have distinct user accounts.
- Platform administrators may access account/billing status and privacy-safe operational metadata, **not customer inventory content** through the admin application. The initial security model is role-restricted, **not cryptographic zero knowledge**.
- Hosting: **AWS primary**, Sydney, one EC2 host and private Single-AZ RDS initially. Auto Scaling/Multi-AZ deferred. Daily credential rotation and safe key-version handling required; live deployment/rotation not yet accepted.

## Change control

Every engineering change should link its feature ID (e.g. `INV-01`) to a test and an API/database migration when applicable. Keep sample payloads fictional; never add real bank QR codes, payment proofs, user photos, credentials, or secrets to the repository.

## Architectural decisions still open

1. Final domain/bundle ID, identity provider implementation, and iOS sign-in mechanism.
2. Final HTTPS origin/domain choice, SES sender, scoped deployment/runtime/rotation roles, AWS sizing/cost estimate and recovery objectives. Primary providers are already selected: AWS RDS/S3/SES.
3. Exact image limits, fair-use limits, credit expiry/return terms, and plan grace periods.
4. App Store eligibility for an unpaid companion app to the paid web service; confirm before public distribution.
5. Philippine tax, registration, consumer protection and privacy compliance before accepting public payments.

