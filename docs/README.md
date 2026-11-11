# BoxVault documentation

> Status: **Product and technical design baseline**, 2026-11-11. Features below describe the **target application**, not deployed or completed functionality. The current scaffold contains only a health API, starter web/iOS UIs, and a preliminary Prisma schema.

## Document map

| File | Contents |
|---|---|
| [product-requirements.md](product-requirements.md) | Users, roles, all feature requirements, workflows, MVP and acceptance criteria |
| [solution-architecture.md](solution-architecture.md) | Monorepo, component boundaries, iOS/web/backend integration, QR/NFC and media architecture |
| [data-model.md](data-model.md) | Entities, relations, constraints, tenancy, migration strategy and retention |
| [api-contract.md](api-contract.md) | Proposed REST routes, representative payloads, errors and idempotency |
| [security-and-privacy.md](security-and-privacy.md) | Threat model, tenant isolation, admin privacy, auth, auditing and incident handling |
| [credits-and-subscriptions.md](credits-and-subscriptions.md) | Web-only manual bank transfer, credit ledger, approvals, annual plans and accounting metrics |
| [operations-and-deployment.md](operations-and-deployment.md) | Home/hybrid deployment, backups, CI/CD, telemetry, SLOs and cost controls |
| [delivery-roadmap.md](delivery-roadmap.md) | Phased implementation backlog, dependencies and launch gates |
| [architecture.md](architecture.md) | Original scaffold architecture overview |
| [development.md](development.md) | Existing local development instructions |

## Approved business decisions

- Annual **Personal**: **PHP 999**; one user.
- Annual **Family**: **PHP 1,999**; up to **4 users total including the owner**.
- Target fixed customer-facing prices: **2027 through 2029**, subject to later business/legal review. Model expense inflation at **10% annually**; do not silently reprice an active term.
- Customers buy closed-loop, non-cash-redeemable software credits through the **React web app only**, via manual bank transfer to the owner's bank QR and receipt submission; authorized administrator independently verifies receipt.
- The **native iOS** app is for inventory, QR/NFC, and account/plan-status features only. **No purchases, pricing, credit top-ups, receipt submissions or external purchasing links/calls to action** in the iOS UI.
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
