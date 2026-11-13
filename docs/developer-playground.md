# VaultBox Developer Playground

**Status:** Local development workspace: fictional UI mocks plus restricted real-local-backend checks. Not a production application.  
**Baseline:** QR architecture and VaultBox Developer Playground merged into `main`. Local backend tester developed independently; PR #4 and PR #6 remain unmerged.  
**Product repository and package namespace:** BoxVault (`@boxvault/*`)  
**Playground display name:** VaultBox Developer Playground

## Purpose

Centralize **all interactive mock interfaces, manual backend test harnesses, and development experiments** under the standalone pnpm workspace application at `apps/playground`, rather than mixing testing screens into the real `apps/web` or `apps/api` production entrypoints.

The Playground is a local-only design and developer environment. UI/QR mocks use fictional session-only fixtures. Its separate Backend Tester can send narrow, explicit requests to an **already running local NestJS API**; this is genuine backend verification, not simulated output. The initial bridge exposes only read-only GET `/api/v1/health` on loopback. It must never point at production, expose credentials, access customer accounts, or serve as an unrestricted API proxy. No databases, billing or Google Ads are integrated through the Playground.

## Location and local commands

```text
apps/playground/
├── index.html                # Launcher / mock catalog
├── qr/
│   ├── index.html
│   └── src/                  # QR Lab mock, own styles and React mount
├── ui/
│   ├── index.html
│   └── src/                  # Dashboard concept mock, own styles and React mount
├── backend/
│   ├── index.html
│   └── src/                  # Real local NestJS health tester, read-only
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Run from the repository root:

```sh
pnpm install --no-frozen-lockfile
pnpm dev:playground
```

Open:
- **http://localhost:5174/** — VaultBox Developer Playground home/catalog
- **http://localhost:5174/qr/** — QR Generator mock
- **http://localhost:5174/ui/** — responsive dashboard mock
- **http://localhost:5174/backend/** — real local backend health tester

`pnpm build:playground` builds the stand-alone multi-page mock app explicitly. The normal `pnpm build` builds **only** `@boxvault/web` and `@boxvault/api`, and does not build or bundle the Playground. Local Vite binds to loopback `127.0.0.1` by default to limit network exposure.

## Mock catalog and ownership

| Mock | Location | Description | Production status |
|---|---|---|---|
| QR Generator Lab | `apps/playground/qr` | Nayuki-style encoder options, SVG/PNG, label preview, diagnostics, light/dark mode | Mock only; no label issuance or authorized route |
| Web Dashboard Mock | `apps/playground/ui` | Responsive navigation, Light/Dark/System, fictional containers/items/family/plan previews | Mock only; does not merge or replace PR #6 |
| Local Backend Tester | `apps/playground/backend` | Live read-only GET health check through dev-only fixed loopback bridge | Local backend only; production not allowed |
| Future mock features | `apps/playground/<feature>` | New experiment plus entry in the launcher catalog | Must not be deployed |

The UI mock is a **copy of the frontend prototype for demonstration purposes**, not a merge of `feature/web-ui-redesign` or PR #6. PR #6's review and backend integration gates remain outstanding. PR #4 remains unmerged and unchanged.

## Rules for all future mocks

1. Place every new mock in a dedicated feature subdirectory of `apps/playground`, with its own entrypoint. Add a discoverable link on the Playground landing page.
2. Use fictional fixtures for mocks and synthetic test accounts/data for approved backend verification. Never use real customer media, live bank QR details, personal data, real label tokens or production credentials.
3. Local backend tests **may call an explicitly allowlisted API on `127.0.0.1` only** via the dev-only bridge, with minimal response disclosure. Never connect to production hosts or permit user-controlled proxy destinations, arbitrary write operations, tokens in URLs, or access to private infrastructure. Future authenticated/negative tests require a separate security-reviewed adapter, isolated disposable dev data and credentials held only in process memory—not committed, logged or persisted.
4. Distinguish fictional mocks from **real** local API responses in labels and feedback. Health and future test runs must be explicitly triggered by the developer and show safe HTTP status/result only.
5. Do not leak demo code into the normal `apps/web` build or link the Playground from production navigation.
6. Use clear local-only notices and `noindex` markup (not as a substitute for access control). Do not publicly deploy the Playground.
7. New mock areas must be responsive, accessible, keyboard navigable and support appropriate light/dark previews.
8. Keep `/docs` updated after each meaningful mock phase and retain separate review/testing gates before any production implementation.
9. Any future server-rendering example should use **fictional** payloads. Actual QR SSR and authorization belong to backend services after PR #4 security gates.

## Validation

CI checks `@boxvault/qr` build + unit tests, `@boxvault/playground` typecheck + multi-page Vite build (including backend tester), and the regular production web/API typecheck/build. Actual backend connectivity is a **manual local integration test**; CI does not claim a local NestJS instance is running.

Manual QA still required: both mock screens on Safari/Chrome/Firefox/Edge and phone/tablet viewports; actual QR decoding and physical print scan checks; keyboard and screen reader review.

## Documentation

- [QR library architecture](qr-library-architecture.md)
- [QR library implementation](qr-library-implementation.md)
- [Web experience and compliance](web-experience-seo-compliance.md)

## Merge integration note

The QR architecture PR was merged before this Playground workstream; the mock implementation has been reconciled on the current `main` baseline. This does not change the independently reviewed frontend PR #6 or backend PR #4.

## Local backend tester: operating contract

The production backend remains in `apps/api` and runs separately. **Only the developer-facing test UI belongs in the Playground.** Do not move NestJS application services, endpoints, migrations or data access logic into a mock tool.

1. In a separate terminal, start the local API: `pnpm dev:api`.
2. In the Playground checkout, start `pnpm dev:playground`.
3. Open `http://localhost:5174/backend/` and select **Run health check**.
4. By default the Playground's Vite development server requests `http://127.0.0.1:3000/api/v1/health`. If the backend listens on a different port, launch the Playground with `BOXVAULT_LOCAL_API_PORT=3001 pnpm dev:playground` (replace 3001 with an actual local port).
5. The bridge accepts **GET only**, rejects unsafe port values, does not follow redirects, restricts the URL to the fixed loopback health path, uses a 5-second upstream timeout, omits browser cookies/authorization, discards unknown fields and suppresses upstream error bodies. It is active only with Vite's **development server**. Static production-like builds do not provide the bridge.
6. If the backend isn't running, the tester displays an unavailable status; it cannot start the API itself.

### Future backend testing extensions (security review required)

- A catalog of explicitly reviewed endpoints and role-based negative tests can be developed under `apps/playground/backend/`, not in customer-facing routes.
- Prioritize health, readiness and synthetic-data workflows. Any testing of authenticated tenant data must use disposable local tenants and audited least-privilege dev credentials.
- Do not implement an unrestricted Postman-like arbitrary URL proxy, a production connection toggle, stored access tokens, database admin access, or destructive operations.
- Server-side QR rendering endpoints, when later approved, remain API-owned; Playground may test them using synthetic data and explicit authorization.
