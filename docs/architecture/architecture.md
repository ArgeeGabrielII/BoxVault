# BoxVault architecture

**Implementation snapshot (2026-11-12; PR #4):** This is the original architecture overview. The current feature branch additionally contains auth/MFA services, restricted auth-versus-content database roles, RLS-protected container-read foundations, and migrations `000`–`005`. Isolated-Neon database phases A–C and scoped earlier CI passed; full browser tenant authorization (own-tenant HTTP 403), media, QR and financial handlers, and launch security gates remain outstanding. See [solution architecture](solution-architecture.md), [M1 audit](../audit/README.md) and [roadmap](../planning/delivery-roadmap.md).

## Application boundaries
- apps/web: React 19 + Vite + Bootstrap 5. Customer inventory and **web-only** manual bank-transfer/credit requests, plus an admin area.
- apps/ios: native SwiftUI companion app, Camera/QR, Core NFC and inventory. No purchasing, bank QR display, receipt uploads, external payment links, or calls to action to buy credits.
- apps/api: NestJS / Prisma / PostgreSQL. The only server authorized to access persistent tenant data.
- packages/assets: first-party static brand assets, not customer content.
- packages/contracts: OpenAPI and generated-client conventions.

## Security requirements before customer launch
1. Implement short-lived access tokens, rotated refresh tokens, rate limits, user verification and secure cookie/Keychain handling.
2. Enforce tenant membership and object-level permissions in every protected API.
3. Add PostgreSQL RLS, transaction-scoped tenant context and cross-tenant integration tests. Prisma schema alone does not provide isolation.
4. Use private object storage and authorize every upload/download. Never log media contents or payment proofs.
5. Implement credit ledger approval with database transactions, idempotency keys, duplicate bank-reference controls, and administrative audit trails.
6. Encrypt off-site backups, test restoration and monitor outages before running on a home server.
7. Confirm applicable App Store companion-app classification before release.

## Billing
Personal: PHP 999/year. Family: PHP 1,999/year (up to 4 total members). Credits purchased exclusively in the web portal by manual bank transfer and verified by an admin. The API owns plan entitlements.

## Status
Scaffold only: public health endpoint and initial relational schema. No account registration, inventory CRUD, financial processing, or production authentication endpoints are shipped in this starting template.
