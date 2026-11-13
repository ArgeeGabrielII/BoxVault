# Firebase Spark mock dashboard CI/CD

**Current status — 2026-11-13:** The owner approved publishing the interactive mock dashboard and creating its dedicated deployment identity. The target is `boxvault-argee-2026`, on Spark with no linked billing account. Earlier public-coming-soon-only and manual-approval plans are superseded for this mock release.

## Deployment scope

`apps/web` is a React/Vite frontend using fictional fixtures. Its demo notice remains visible. Creating boxes changes in-memory state only; appearance preference is stored locally. The [admin UI preview](experience/admin-preview.md) is available at `/#/admin/overview` with synthetic account/billing metadata and session-only decisions. No backend, database, live authentication, payment flow or Playground is published. Firebase serves static dashboard files with `connect-src 'none'` to block backend requests. Inline styles support React presentation; scripts are restricted to the site's own assets.

## Pipeline

The `.github/workflows/firebase-spark.yml` workflow validates relevant pull requests without deploying. Relevant pushes to `main`, or a manual run on `main`, perform:

1. Install dependencies from the committed pnpm lockfile.
2. Typecheck and build `@boxvault/web`.
3. Audit the dashboard artifact with `infrastructure/firebase/verify-preview.mjs` (allowed paths, size, no secrets/private service references, mock notice, correct Hosting target and network-blocking CSP).
4. Upload the reviewed output and download that same artifact in the deploy job.
5. Authenticate using the dedicated Hosting service account stored in GitHub's environment secret.
6. Fail deployment unless Cloud Billing reports `billingEnabled: false` and no linked billing account.
7. Publish only Firebase Hosting's live channel.

The original `apps/public-site` coming-soon source remains in the repository for reference; it is no longer the deployment input. API, database and general CI checks continue independently on `main`.

## Identity and configuration

- Project and Hosting site: `boxvault-argee-2026`.
- URL: https://boxvault-argee-2026.web.app
- GitHub environment: `firebase-spark-public`, with deployment branch restricted to `main`.
- Environment secret: `FIREBASE_SPARK_DEPLOY_SA_JSON`. Its value is never committed, printed or saved as a local credential file during provisioning.
- Dedicated account: `github-hosting-deploy@boxvault-argee-2026.iam.gserviceaccount.com`.
- Project roles: Firebase Hosting Admin, Service Usage Consumer and API Keys Viewer. No Owner, Editor, billing-change, database or authentication administration role is granted.
- Repository variables: `FIREBASE_SPARK_PROJECT_ID=boxvault-argee-2026`, `FIREBASE_SPARK_DEPLOY_ENABLED=true`.
- The owner's explicit authorization enables automatic main-branch deployment without a separate reviewer click for each release.

## Verification and rollback

```sh
pnpm --filter @boxvault/web typecheck
pnpm --filter @boxvault/web build
node infrastructure/firebase/verify-preview.mjs
```

Check the GitHub Actions deployment result and live dashboard after a release. Monitor Firebase Hosting usage; quota exhaustion must not trigger a Blaze upgrade. The billing check is point-in-time and cannot prevent a separate administrator from later attaching billing.

To stop automatic deployments, set `FIREBASE_SPARK_DEPLOY_ENABLED=false`. Roll back to a known clean Hosting release in the Firebase console if needed. For credential rotation, replace the environment secret and revoke the old service-account key. Keep credentials out of logs and repository files.

## Official references

- [Firebase GitHub integration](https://firebase.google.com/docs/hosting/github-integration)
- [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Firebase Hosting configuration](https://firebase.google.com/docs/hosting/full-config)
