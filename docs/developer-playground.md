# VaultBox Developer Playground

**Status:** Development-only mock workspace. Not a production application.  
**Branch:** `feat/qr-library-mock-lab` (PR #8, stacked on architecture PR #7)  
**Product repository and package namespace:** BoxVault (`@boxvault/*`)  
**Playground display name:** VaultBox Developer Playground

## Purpose

Centralize **all interactive mock interfaces and experiments** under a standalone pnpm workspace application at `apps/playground`, rather than mixing mock screens into the real `apps/web` or `apps/api` production entrypoints.

The Playground is a local-only design and developer environment. It does not access production customer accounts, issue valid QR tokens, authorize storage access, or integrate with databases, billing or Google Ads. All fixtures are fictional and session-only.

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

`pnpm build:playground` builds the stand-alone multi-page mock app explicitly. The normal `pnpm build` builds **only** `@boxvault/web` and `@boxvault/api`, and does not build or bundle the Playground. Local Vite binds to loopback `127.0.0.1` by default to limit network exposure.

## Mock catalog and ownership

| Mock | Location | Description | Production status |
|---|---|---|---|
| QR Generator Lab | `apps/playground/qr` | Nayuki-style encoder options, SVG/PNG, label preview, diagnostics, light/dark mode | Mock only; no label issuance or authorized route |
| Web Dashboard Mock | `apps/playground/ui` | Responsive navigation, Light/Dark/System, fictional containers/items/family/plan previews | Mock only; does not merge or replace PR #6 |
| Future mock features | `apps/playground/<feature>` | New experiment plus entry in the launcher catalog | Must not be deployed |

The UI mock is a **copy of the frontend prototype for demonstration purposes**, not a merge of `feature/web-ui-redesign` or PR #6. PR #6's review and backend integration gates remain outstanding. PR #4 remains unmerged and unchanged.

## Rules for all future mocks

1. Place every new mock in a dedicated feature subdirectory of `apps/playground`, with its own entrypoint. Add a discoverable link on the Playground landing page.
2. Do not use real user media, live bank QR details, personal data, access tokens, real label tokens or unapproved production credentials.
3. Do not call private APIs or connect to Neon, PostgreSQL or production backend services.
4. Mock controls must visibly indicate that changes are simulated/nonpersistent.
5. Do not leak demo code into the normal `apps/web` build or link the Playground from production navigation.
6. Use clear local-only notices and `noindex` markup (not as a substitute for access control). Do not publicly deploy the Playground.
7. New mock areas must be responsive, accessible, keyboard navigable and support appropriate light/dark previews.
8. Keep `/docs` updated after each meaningful mock phase and retain separate review/testing gates before any production implementation.
9. Any future server-rendering example should use **fictional** payloads. Actual QR SSR and authorization belong to backend services after PR #4 security gates.

## Validation

CI checks `@boxvault/qr` build + unit tests, `@boxvault/playground` typecheck + multi-page Vite build, and the regular production web/API typecheck/build.

Manual QA still required: both mock screens on Safari/Chrome/Firefox/Edge and phone/tablet viewports; actual QR decoding and physical print scan checks; keyboard and screen reader review.

## Documentation

- [QR library architecture](qr-library-architecture.md)
- [QR library implementation](qr-library-implementation.md)
- [Web experience and compliance](web-experience-seo-compliance.md)
