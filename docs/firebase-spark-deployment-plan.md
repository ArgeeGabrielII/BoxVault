# ADR-CLD-001 — Firebase Spark-only static deployment for BoxVault

> **2026-11-13 decision update:** The owner explicitly authorized publishing the interactive mock dashboard and its CI/CD deploy identity. The earlier coming-soon-only scope and per-release manual approval below describe the original plan. The current static deployment uses `apps/web` with fictional fixtures, no backend connections, and Spark billing safeguards. See [current CI/CD](firebase-spark-cicd.md).

**Status:** Proposed for approval; **no Firebase project, credentials, site, deployment workflow, or running service has been created**  
**Date:** 2026-11-13  
**Scope:** Google Cloud / Firebase **Spark-only** deployment of public static content; Google Cloud spending target PHP 0 and no billing-account link  
**Decision owner:** BoxVault product / architecture  
**Implementation branch:** Documentation only

## Executive decision

Deploy only a **separate, sanitized, public static site** for BoxVault using Firebase Hosting's no-cost Spark plan. No Google Cloud billing account may be linked. The genuine `apps/web` application and `apps/api` NestJS services, private content, PostgreSQL, user sessions, paid subscriptions, family authorization, QR token issuance / label resolution and server-side QR rendering must **not** be deployed within this Spark-only phase. The VaultBox Developer Playground remains bound to localhost and must **never** be published.

**Critical distinction:** A no-cost Spark project can be quota-throttled or taken offline once a quota is reached. The requirement is zero *Google Cloud billing*, not guaranteed unlimited availability. Firebase Hosting Spark is not a free NestJS/SSR or PostgreSQL host.

### Binding policy / hard cost controls

1. Provision a **new Firebase project from the Firebase console** on Spark with **no linked Cloud Billing account**. Do not attach a billing account later; attaching one upgrades the project to Blaze. Do not use any free trial that is tied to billable resources.
2. Allow only **Firebase Hosting (static assets)** for this deployment. Deny/defer Cloud Run, Cloud Functions, App Hosting, Cloud SQL, SQL Connect, Artifact Registry, Cloud Build, cloud object storage, paid APIs, analytics exports, and any resource requiring Blaze. Other Firebase Spark-eligible features may be assessed in separate ADRs; do not auto-enable them.
3. Do not enable automatic paid-tier upgrades. If the hosting limit is exhausted, **fail closed with service interruption**; do not upgrade to Blaze to restore availability. Operational owners must accept this tradeoff.
4. No externally reachable backend, authentication, tenant storage, live QR token, real user item, bank QR / payment proof, signed media URL, app secrets, or production API origin is permitted in published static files.
5. Explicitly ban `apps/playground` and its QR/real-local-backend test tooling from the deployment build. The built output must be allowlisted and reviewed, not assembled from all apps.
6. Start with **manual deploy approval** only. Do not add GitHub continuous auto-deploy or preview deployments until the project plan check, least-privilege deploy identity and quotas have been verified.
7. Track **Google Cloud billed charges = PHP 0** as a constraint; owner time, optional purchased domain, GitHub Actions usage, and internet access are *separate costs*, not included in that claim.

## Scope and proposed module layout (future, not implemented)

```text
BoxVault/
  apps/
    public-site/                     [FUTURE] static informational site
      src/
      public/
      dist/                          [FUTURE] build output, untracked
    web/                             actual customer/admin app — not published
    api/                             NestJS + PostgreSQL — not published
    playground/                      local-only mocks/backend tester — forbidden to publish
    ios/                             not hosted by Firebase Hosting
  infrastructure/
    firebase/                        [FUTURE] approved Hosting-only configuration
  docs/
    firebase-spark-deployment-plan.md
```

Use a **dedicated static public site** rather than deploying the existing `apps/web` development starter, its Vite environment/config, the Playground, or a copied dashboard. A future `apps/public-site` can share safe, first-party visual assets but must not import tenant inventory, operator/admin modules, auth session managers, Playgrounds, private env variables or paid-service SDKs.

Phase-1 public content candidates:
- Home page explaining QR/NFC storage organization, with no working private QR resolver.
- Original guides/tutorials and FAQ for storage organizing and QR labeling.
- Public contact, privacy notice and terms (after legal review).
- Clear, nonfunctional “Coming soon” CTA; do not falsely promise a live customer product.
- A small 404 page and accessible responsive navigation.

Optional Google Ads on *eligible substantial public editorial content* remains a separately reviewed future feature, **not** part of initial Spark deployment. No forced countdown, no AdSense SDK, no Google user-profile or private item data on this site initially.

## Target logical architecture

```text
GitHub main (public-site source only)
  -> CI static validation / secret and output denylist checks
  -> manual release approval
  -> Firebase CLI / least-privilege deploy operator [future]
  -> Firebase Hosting (Spark, billing account UNLINKED)
  -> https://<approved-site-id>.web.app (Firebase HTTPS/CDN)

Independent non-cloud lanes:
  Local browser -> localhost:5174 VaultBox Developer Playground
  Local API     -> localhost:3000 NestJS
  Private database and media stay outside this Firebase project.
```

We will use the Firebase-provided `.web.app` site address first to avoid domain purchase, DNS or external hosting charges. A custom domain is supported by Firebase Hosting, but **registration and renewal are not free** and are excluded from phase 1. Do not guess the Firebase project ID, site ID, deploy principal, or endpoint until the operator creates them.

**Current 2026 setup behavior:** Since **2026-10-15**, new Firebase projects no longer automatically create a default Hosting site at project creation; initiate Hosting setup in the Firebase console and ensure the site is explicitly created before first deployment.

## Firebase quota and cost model (verified on 2026-11-13)

| Metric | Official published value | Notes |
|---|---|---|
| Spark plan | No payment information required | Ensure Cloud Billing remains **unlinked** |
| Hosting stored releases/assets | 10 GB project quota | Old releases and preview channels consume storage |
| Hosting transfer | **10 GB/month** in detailed Hosting usage guide | The Firebase pricing grid still lists **360 MB/day**; verify the project's actual limits in the console before activation |
| Per-file Hosting max | 2 GB | Our own release gate must be far lower |
| Default `.web.app` domain and managed HTTPS | Included with Hosting | No domain registration expense |
| Cloud Run / Cloud Functions / Cloud SQL / App Hosting SSR | Not in approved Spark static scope | Do not enable as “free-tier” replacements |
| Over-quota Spark behavior | Storage: cannot deploy; transfer: sites disabled after short grace period | Do not attach billing to recover access |

**Discrepancy to reconcile:** The detailed Firebase Hosting quota page states **10 GB/month transfer**, while the general Firebase pricing comparison advertises **360 MB/day for Hosting**. Treat the specific project dashboard as the operational source of truth, never size to the larger value before verifying it. To remain cautious during pilot, use internal daily monitoring and a transfer guardrail equivalent to **<= 200 MB/day average** as well as a monthly cap. Usage is counted at the project level across sites and channels, including CDN cache hits.

**Internal budgets (engineering guardrails, NOT Firebase quotas):**
- Target under **25 MB** total *uncompressed* initial static release, and under **1 MB** compressed initial page transfer; measure before publishing and optimize assets.
- Target a maximum **three retained releases** initially and no indefinitely living preview channels; exact retention setting verified in the console.
- Warning at **70%** of confirmed transfer/storage quota; freeze nonessential deployments or asset growth at **85%**; initiate deliberate site reduction or shutdown before exhaustion.
- During pilot, check Hosting usage **daily** and before/after deploy; owner signs off monthly on Spark plan and billing-unlinked state.
- Keep a simple manually updated quota ledger in the release record. Budget notifications do **not** cap spending and are not a substitute for Spark billing control.
- If access spikes or service quota is exhausted, the site may go offline. **No “upgrade to Blaze” fallback**.

## Security and privacy controls

1. Deploy a fully public **non-sensitive** static artifact only. Firebase Hosting does not make public files private via `robots.txt`, `noindex`, or hidden routes.
2. Explicitly deny packaging of `.env*`, service-account JSON, secrets, private keys, bank payment data, raw QR tokens, JWTs, customer media, source maps containing secrets, internal OpenAPI/auth/admin documents, or local Playground artifacts.
3. Use a security-oriented `firebase.json` Hosting-only config (future implementation) pointing **exactly to** the dedicated public-site output directory; include proper cache headers, MIME handling, safe redirects, custom 404, and conservative CSP/Referrer-Policy/X-Content-Type-Options headers after testing.
4. No Hosting rewrite/proxy to Cloud Run, Functions, unapproved API domain or arbitrary external redirects. No SPA catch-all that masks errors or private route handling.
5. No frontend secret stored in `VITE_*`, client bundles, HTML metadata, GitHub workflow text, deployment logs or issue descriptions. Firebase web config keys, if ever introduced, are not server-side secrets, but access permissions still require explicit security rules.
6. Do not install Firebase SDKs, Google Ads scripts, or analytics by default. Any consent, tracking and advertiser integration needs a separate privacy/legal review.
7. Restrict human deploy permissions; use least-privilege deployment identity when later automating. Do not commit service-account JSON; prefer an approved short-lived identity path if supported. Do not give a GitHub workflow unrestricted admin privileges.
8. Do not expose the developer health bridge or dev server to the network: `apps/playground` stays loopback-only, with dev API using a fixed local endpoint. Deploy-time and postdeploy tests must assert absence of `/backend`, `/qr`, `/ui` Playground paths and all private API/admin paths.
9. Public site is NOT the real SaaS and cannot perform secure label issuance, authenticated QR/NFC resolution, SSR, database operations or private inventory.
10. Copyright/license review for assets, and accessible SEO/legal content required before the site goes live.

## Planned delivery pipeline — two approval stages

### Stage 0: design approval (this ADR)

- Review plan and source-based pricing constraints.
- Approve static-only scope, privacy boundary, accept quota-driven downtime, and designate the person responsible for usage monitoring.
- Confirm that **no Firebase project, deployment, or credentials are created at this stage**.

### Stage 1: build a separately reviewed static-site implementation (future PR)

- Create `apps/public-site` with source, `dist/` output and a distinct build script; `apps/playground`, `apps/web` and `apps/api` are not imported.
- Add only Hosting configuration in `infrastructure/firebase/`; never enable any billable service via CLI.
- CI checks: lint/typecheck/build, unit/content tests, secret scanning, excluded-path/package checks, asset size cap, known-origin and URL validation, CSP/headers validation, zero links to Playground/local APIs, and preview of exact deploy file list.
- Build a deployment manifest (file names, sizes, SHA256) and test it locally. Must not contain `node_modules`, `apps/playground`, `.env`, `*.map` with secrets, `apps/api`, `prisma`, bank QR details, or local filenames.
- No automatic deploy and no service account committed. Merge only with designated architecture/security review.

### Stage 2: manual Firebase provisioning and first deployment (requires separate explicit user authorization)

1. Create or choose a new Spark Firebase project; verify **Spark** and **no linked billing account** in console.
2. Set up Firebase Hosting and **explicitly confirm default Hosting site creation** (new projects since Oct 15, 2026).
3. Verify site ID/URL, site-specific Hosting limits, release retention setting, and role permissions; record safe metadata (not secrets) in a private operational record.
4. Install/login to Firebase CLI using the operator's authorized local environment; no ChatGPT-stored credentials.
5. From a release-verified directory, choose the exact intended Firebase project and deploy **Hosting only** after explicit approval; never run an unscoped `firebase deploy` that could deploy Functions or other resources.
6. Verify public HTTPS, headers, correct content and 404, no unwanted routes or secrets, console transfer/storage usage, and Spark/billing-unlinked status immediately after release.
7. Record the release commit hash, who approved/deployed, storage/transfer usage, QA outcome and rollback candidate.

### Rollback, incident, and quota exhaustion

- Use a known clean earlier Hosting release for rollback if quota permits; note older releases consume storage, and may require deleting unneeded versions.
- If unsafe content was accidentally published, **remove the content from Hosting** and investigate caching/third-party archival; rolling back alone may not erase copies.
- On accidental billing-account link/Blaze upgrade, halt all deployment activities, unlink billing through authorized operator, and review incurred charges; simply setting a nominal budget is not protection.
- If quota usage approaches exhaustion, reduce asset size or disable the static site; accept interruption rather than using paid services.
- If a Cloud Run/Functions/SQL or other nonapproved resource appears, treat as a policy violation, inventory it and remove it with appropriate authorization.
- Reassess cost and capabilities before any move toward full SaaS deployment; any paid compute or SSR requires a new explicit architecture approval.

## Open questions / decisions before Stage 1

1. Is the first public site a marketing landing page only, or landing page + substantial guides / FAQ?
2. Who is the deployment approver and daily/monthly quota monitor?
3. Firebase project ID/site ID, Hosting usage console transfer allowance and site location — **not yet known**.
4. Whether a free `web.app` domain is acceptable initially; custom domain registration is a separate cost.
5. Should a publicly viewable screenshot/video of the mock dashboard be included? Only if fully sanitized and minimized for transfer quotas.
6. When (if ever) can the full NestJS SSR service be exposed? **Not under this Spark-only ADR.**

## Official references (verified 2026-11-13)

- Spark / Blaze plans and billing linkage: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Firebase Hosting quotas: https://firebase.google.com/docs/hosting/usage-quotas-pricing
- Firebase pricing comparison: https://firebase.google.com/pricing/
- Default Hosting site (Oct 15 2026 change): https://firebase.google.com/docs/hosting/default-site
- Hosting configuration (headers and rewrites): https://firebase.google.com/docs/hosting/full-config
- Hosting releases and retention: https://firebase.google.com/docs/hosting/manage-hosting-resources
- Firebase Hosting quickstart: https://firebase.google.com/docs/hosting/quickstart
- GitHub/Hosting integration (future, not enabled): https://firebase.google.com/docs/hosting/github-integration
