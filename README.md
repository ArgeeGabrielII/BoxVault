# BoxVault

QR/NFC-powered storage organization. One monorepo for the customer web portal, native iOS app, API, shared assets, and API contracts.

## Stack
- Web: React 19, Vite, TypeScript, Bootstrap 5
- API: NestJS, TypeScript, Prisma 6, PostgreSQL
- iPhone: SwiftUI, Core NFC, AVFoundation (XcodeGen project definition)
- Package management: pnpm workspaces, Node 22
- Hosting: home/hybrid deployment later; production security hardening required

## Structure
- `apps/web` — customer and admin web application
- `apps/api` — NestJS REST API and Prisma schema
- `apps/ios` — native SwiftUI iPhone app
- `packages/assets` — shared first-party visual assets
- `packages/contracts` — OpenAPI / cross-platform generated clients
- `packages/config` — future shared lint/formatting config
- `docs` — architecture and security decisions
- `infrastructure` — deployment configuration

## Local setup (no Docker required)
Prerequisites: Node.js 22+, pnpm 10+, PostgreSQL 16+; Xcode and XcodeGen for iOS.

```sh
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Create a local PostgreSQL database matching DATABASE_URL.
pnpm db:generate
pnpm db:migrate
pnpm dev:api
# In a second terminal:
pnpm dev:web
```

Web: http://localhost:5173
API health: http://localhost:3000/api/v1/health

iOS: `cd apps/ios && xcodegen generate`, then open `BoxVault.xcodeproj` in Xcode. The iOS app expects a reachable API URL; the simulator uses localhost and physical devices need a LAN/TLS URL.

## Developer Playground (mock-only)

The **VaultBox Developer Playground** centralizes QR Generator and responsive web UI mockups in `apps/playground`, completely separate from normal production app builds. Start it with `pnpm install --no-frozen-lockfile && pnpm dev:playground` and open http://localhost:5174/. See [playground documentation](docs/developer-playground.md). Do not deploy the Playground publicly.

## Security
**This is an initial development scaffold, not production-ready.** Prisma models are not access controls. No private inventory or credit approval APIs are exposed until authentication, authorization, row-level security, and audit controls have been implemented. Never commit .env files, account details, user media, or payment receipts.

## Subscriptions
Personal PHP 999/year; Family PHP 1,999/year (up to four including owner). Credits are purchased and redeemed on the web only. iOS is storage/inventory-only, subject to Apple review.
