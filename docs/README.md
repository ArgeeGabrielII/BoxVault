# BoxVault documentation

**Progress snapshot — 2026-11-13:** PR #4 includes staged NestJS authentication/MFA, token-bound verified-email onboarding, restricted database roles, Prisma migrations `000`–`005`, and per-container ACL/RLS foundations. Isolated Neon database phases A–C were verified and scoped CI passed on an earlier commit; local register → email verify → login succeeded. **Current-head full acceptance remains pending**; a local browser retest confirmed tenant isolation **401 unauthenticated / 200 own tenant (0 containers) / 403 unrelated tenant**. Other authorization and release gates remain pending. PR #4 is **not production-approved**. Start with the [roadmap](planning/delivery-roadmap.md), [audit register](audit/README.md), and [Phase D latest results](audit/api/phase-d-real-provider-validation.md).

> **Source consolidation — 2026-11-13:** The owner authorized consolidating the development branches into `main`. Earlier branch-isolation and merge-hold notes are historical. Production security acceptance remains pending; the owner approved the mock `apps/web` dashboard as the Firebase Hosting input; backend services remain outside this deployment.

Mock materials are organized under [mock documentation](mock/README.md): [tester guides](mock/documents/README.md) and [test-data catalog](mock/data/README.md) are separate; the [runnable HTML](../mock/boxvault-m1-registration-harness.html) stays under `/mock`. Mock helpers are **not production API contracts**.

## Start here

1. [Product requirements](product/product-requirements.md)
2. [Solution architecture](architecture/solution-architecture.md)
3. [Security-first standard](security/security-first-standard.md)
4. [M1 security gate status](security/m1-security-gate-status.md)
5. [Development workflow](development/development.md)
6. [Delivery roadmap](planning/delivery-roadmap.md)

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
| [architecture.md](architecture/architecture.md) | Starter scaffold architecture |
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

- [Admin console UI preview](experience/admin-preview.md) — mock account/billing operations, review flows and QA.

| Document | Description |
|---|---|
| [web-experience-seo-compliance.md](experience/web-experience-seo-compliance.md) | SEO, accessibility, web UX and compliance |

### QR and Developer Playground

| Document | Description |
|---|---|
| [Developer Playground](developer-playground.md) | Local-only interactive labs |
| [QR implementation](qr-library-implementation.md) | QR package and verification |
| [QR architecture](qr-library-architecture.md) | Encoder architecture |

### Development & Integrations

| Document | Description |
|---|---|
| [development.md](development/development.md) | Local setup and developer workflow |
| [neon-connection.md](development/neon-connection.md) | Neon database environment configuration |
| [neon-agent-skills-mcp.md](development/neon-agent-skills-mcp.md) | Neon MCP and agent skill guidance |
| [m1-neon-free-tier-validation.md](development/m1-neon-free-tier-validation.md) | Free-tier and deployment validation |
| [m1-neon-reconciliation-audit-2026-11-12.md](development/m1-neon-reconciliation-audit-2026-11-12.md) | Neon reconciliation audit |

### Operations

| Document | Description |
|---|---|
| [operations-and-deployment.md](operations/operations-and-deployment.md) | Deployment, reliability, backup and cost controls |
| [Firebase Spark deployment](firebase-spark-deployment-plan.md) | Static Hosting and zero billing controls |
| [Firebase Spark CI/CD](firebase-spark-cicd.md) | Main branch deployment pipeline |

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
| [README.md](audit/README.md) | M1 phase-by-phase engineering audit register and evidence |

---

## Approved business decisions

- Annual **Personal**: **PHP 999**; one user.
- Annual **Family**: **PHP 1,999**; up to **4 users total including the owner**.
- Target fixed customer-facing prices: **2027 through 2029**, subject to later business/legal review. Model expense inflation at **10% annually**; do not silently reprice an active term.
- Customers buy closed-loop, non-cash-redeemable software credits through the **React web app only**, via manual bank transfer to the owner's bank QR and receipt submission; authorized administrator independently verifies receipt.
- The **native iOS** app is for inventory, QR/NFC, and account/plan-status features only. **No purchases, pricing, credit top-ups, receipt submissions or external purchasing links/calls to action** in the iOS UI.
- Family sharing is **private by default per container**; owners explicitly grant access to selected family members or all active members. See [family-sharing-access-control.md](product/family-sharing-access-control.md).
- A subscription is owned by a **tenant** (individual or family), not a device. Family members have distinct user accounts.
- Platform administrators may access account/billing status and privacy-safe operational metadata, **not customer inventory content** through the admin application. The initial security model is role-restricted, **not cryptographic zero knowledge**.
- Hosting direction: **home or hybrid** is under consideration, not final.

## Change control

Every engineering change should link its feature ID (e.g. `INV-01`) to a test and an API/database migration when applicable. Keep sample payloads fictional; never add real bank QR codes, payment proofs, user photos, credentials, or secrets to the repository.

## Architectural decisions still open

1. Final domain/bundle ID, identity provider implementation, and iOS sign-in mechanism.
2. Home-only versus hybrid primary media hosting; ISP terms and recovery objectives.
3. Exact image limits, fair-use limits, credit expiry/return terms, and plan grace periods.
4. App Store eligibility for an unpaid companion app to the paid web service; confirm before public distribution.
5. Philippine tax, registration, consumer protection and privacy compliance before accepting public payments.

