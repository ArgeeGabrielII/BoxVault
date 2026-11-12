# BoxVault documentation

> **Status:** Product and technical design baseline, 2026-11-11. Most features describe the intended product, not already deployed functionality. Current implementation is an early scaffold.

## Start here

1. [Product requirements](product/product-requirements.md)
2. [Solution architecture](architecture/solution-architecture.md)
3. [Security-first engineering standard](security/security-first-standard.md)
4. [Development workflow](development/development.md)
5. [Delivery roadmap](planning/delivery-roadmap.md)

## Documentation by category

### Product & Billing

| Document | Purpose |
|---|---|
| [product-requirements.md](product/product-requirements.md) | Product requirements, workflows and MVP scope |
| [family-sharing-access-control.md](product/family-sharing-access-control.md) | Private-by-default container sharing and family permissions |
| [credits-and-subscriptions.md](product/credits-and-subscriptions.md) | Credits, annual plans and manual payment flows |

### Architecture & API

| Document | Purpose |
|---|---|
| [solution-architecture.md](architecture/solution-architecture.md) | Technical architecture and platform boundaries |
| [architecture.md](architecture/architecture.md) | Original scaffold architecture overview |
| [data-model.md](architecture/data-model.md) | Database model, relationships and tenancy |
| [api-contract.md](architecture/api-contract.md) | Proposed REST contract and error conventions |

### Security & Privacy

| Document | Purpose |
|---|---|
| [security-first-standard.md](security/security-first-standard.md) | Mandatory security engineering invariants |
| [security-and-privacy.md](security/security-and-privacy.md) | Threat model, isolation and privacy |
| [authentication-google-mfa-captcha.md](security/authentication-google-mfa-captcha.md) | Sign-in, MFA and anti-bot controls |
| [security-release-checklist.md](security/security-release-checklist.md) | Security release gates and verification checklist |

### Web Experience

| Document | Purpose |
|---|---|
| [web-experience-seo-compliance.md](experience/web-experience-seo-compliance.md) | SEO, UX, accessibility and compliance |

### Development & Integrations

| Document | Purpose |
|---|---|
| [development.md](development/development.md) | Local development workflow |
| [neon-connection.md](development/neon-connection.md) | Neon PostgreSQL configuration |
| [neon-agent-skills-mcp.md](development/neon-agent-skills-mcp.md) | Neon agent skills and MCP setup |

### Operations

| Document | Purpose |
|---|---|
| [operations-and-deployment.md](operations/operations-and-deployment.md) | Hosting, deployment, backups and reliability |

### Planning

| Document | Purpose |
|---|---|
| [delivery-roadmap.md](planning/delivery-roadmap.md) | Delivery phases and definitions of done |

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
