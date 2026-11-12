# Implementation Roadmap and Definition of Done

The repository currently contains **starter scaffolding**, not an end-to-end customer-ready product. Deliver in small vertical slices and require evidence for security/finance controls.

## Phase 0 — Foundation (existing scaffold, then stabilize)

- [x] Monorepo layout: `apps/web`, `apps/api`, `apps/ios`, `packages/assets`, `packages/contracts`.
- [x] Basic React starter and NestJS `GET /api/v1/health`.
- [x] Preliminary Prisma schema and initial SwiftUI QR scanner.
- [ ] Verify `pnpm install`, web/API builds and iOS Xcode project on Mac.
- [ ] Environment secret templates, tests, lint/format, CI/CD integration.
- [ ] Decide hosting topology and media provider.

## Phase 1 — Identity and multi-tenancy (MVP, blocking)

- [ ] Email verification, login/reset, Argon2id, session refresh/revocation.
- [ ] Owner tenant creation, membership and family invitation with **4-seat total** cap.
- [ ] NestJS guards and object authorization + PostgreSQL RLS.
- [ ] Cross-tenant negative tests and safe audit events.
- **Done when** two unrelated households cannot read/write each other's records through any protected route, including list/search/count.

## Phase 2 — Inventory + labels + native scan (MVP)

- [ ] Location hierarchy; container/item CRUD; planned container quotas.
- [ ] Quick overview photo, thumbnails, private media store, storage usage accounting.
- [ ] Generate random QR labels and authorized resolve endpoint.
- [ ] React search/list/detail, native SwiftUI list/detail/camera/QR integration.
- [ ] Read NFC NDEF URLs / Universal Links on physical iPhone.
- **Done when** create → photograph → label → scan → securely view works for owner and invited family member; outsiders denied.

## Phase 3 — Credits and subscription (MVP, WEB ONLY)

- [ ] Configure priced plans: Personal **999**, Family **1,999** credits for annual term.
- [ ] Web-only bank QR display, top-up request, receipt upload and history.
- [ ] Admin bank verification, approval/rejection, idempotent wallet credit transaction.
- [ ] Web-only credit redemption; entitlement and expiry enforcement in API.
- [ ] Subscription status **read-only and neutral** in iOS.
- **Done when** duplicate approval/retry cannot increase wallet twice; failure rolls back all financial changes; iOS contains no purchase UI.

## Phase 4 — Admin analytics, security and pilot launch

- [ ] Admin dashboard: cash collected, credit issued/redeemed, outstanding credit, paid/expired tenants, activity, retention.
- [ ] Correlation-ID troubleshooting without inventory content.
- [ ] Owner support and consent-based win-back audience segmentation.
- [ ] Backup/restore drill, rate limits, secrets, 2-tenant security suite, incident process.
- [ ] Validate Philippine legal/tax registration, terms/privacy, and Apple companion app posture.
- [ ] Closed pilot with synthetic then consented real data and manual payment controls.
- **Done when** nonfunctional, compliance and payment controls pass release checklist and recovery can be executed.

## Phase 5 — V1 enhancements

- [ ] Native NFC tag writing, label rotation and bulk print.
- [ ] Family box-level private ACL, tenant ownership transfer, offline secure cache.
- [ ] Export/import, bulk edit/move and storage quota management UI.
- [ ] Payment dispute/reversal, receipts and more detailed analytics.
- [ ] Scalability review using actual throughput and costs.

## Later ideas (not committed)

AI item suggestions, barcode scanning, Android, advanced zero-knowledge family encryption, optional business tiers, automated gateways when appropriately registered.

## Engineering Definition of Done (all features)

1. Feature ID linked to approved requirements and tests.
2. API DTO/OpenAPI updated and generated clients match Swift and TypeScript.
3. Tenant RBAC and RLS positive/negative tests present.
4. Inputs validated; errors and empty/loading states implemented.
5. Safe audit/metrics recorded; no protected content in logs.
6. Relevant storage/money limits, concurrency and retries tested.
7. Documentation and rollback/migration instructions updated.
8. CI green and native on-device functionality verified where required.

## Release blockers (must not waive casually)

Cross-tenant data leakage; private photo/object exposure; duplicate-credit race; lost/no off-site backup; noncompliant App Store payment flows; unreviewed legal requirements for public sales; untested member removal/session revocation; operator access to inventory content.
