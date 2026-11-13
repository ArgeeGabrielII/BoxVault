# Firebase Spark CI/CD — main branch

**Status:** Implemented pipeline **configuration only**. No Firebase project, credentials, deployment or Google Cloud service has been provisioned by this change.

See [Spark architecture](firebase-spark-deployment-plan.md). This deployment is **only** for the intentionally public coming-soon static site in `apps/public-site`, not BoxVault's customer application.

## Pipeline overview

```text
Pull request touching public-site / workflow / firebase.json
  -> GitHub Actions: build from exact allowlist
  -> reject unexpected files, scripts, private URLs and secrets
  -> audit firebase.json (Hosting only)
  -> NO DEPLOY ON PR

Merge to main (matching paths)
  -> same build and validation
  -> only when repo variable FIREBASE_SPARK_DEPLOY_ENABLED == 'true'
       -> GitHub environment firebase-spark-public (approval protection if configured)
       -> read approved build artifact
       -> validate site and Firebase project ID
       -> authenticate dedicated deploy service account
       -> query Cloud Billing projects.getBillingInfo
       -> FAIL unless billingEnabled is explicitly false and billingAccountName is absent
       -> Firebase Hosting live channel only

Without flag/secret/approval: validation works; deployment is skipped or denied.
```

The workflow also supports manual **Actions > Firebase Spark Static Site CI/CD > Run workflow** on `main`. Manual triggering does not bypass the deployment enable flag or billing check. The `firebase-spark-public` environment must be configured with approval protection by a repo administrator **before enabling deployment**; creating an environment name in YAML alone does not create required reviewers.

## Files

- `.github/workflows/firebase-spark.yml` — dedicated public-site CI/CD
- `apps/public-site/static/` — static public informational pages only
- `apps/public-site/scripts/build.mjs` — deterministic allowlist file copy
- `apps/public-site/scripts/verify.mjs` — audit exactly four public artifacts, size, prohibited content and Firebase Hosting config
- `apps/public-site/scripts/assert-spark.mjs` — Google Cloud Billing API fail-closed verification
- `firebase.json` — strictly Hosting-only config pointing to `apps/public-site/dist`

The normal `apps/web` / `apps/api` builds and `apps/playground` are not deployment inputs. No frontend/backend PRs are merged.

## Before enabling continuous deployment

1. Create a **new Firebase Spark project**, leave Cloud Billing **unlinked**, and explicitly create its Firebase Hosting site. Check the Firebase console shows Spark, with no billing account. Record the exact site/project ID.
2. Check current Firebase Hosting usage and quotas and accept that exhausted Spark quotas can disable Hosting. Monitor usage from the Firebase console.
3. Create a **dedicated service account** with access to deploy to Firebase Hosting and read project billing info. Limit roles to what deploy tooling and read-only billing check require. Google documents `projects.getBillingInfo` as requiring `resourcemanager.projects.get` on that project (e.g. Project Viewer). Review the action's minimal IAM requirements; avoid Owner/Editor and permissions to modify billing.
4. Create GitHub environment **`firebase-spark-public`**, restrict deployments to `main`, configure required reviewers if available to your GitHub repository plan. If plan/access does not support approvals, keep deployment disabled and use a separately approved manual release procedure.
5. Add GitHub **environment secret** `FIREBASE_SPARK_DEPLOY_SA_JSON` containing the deploy service-account JSON. Never commit the credential, print it in CI, or use production credentials.
6. Set repo **Actions variable** `FIREBASE_SPARK_PROJECT_ID` to the exact approved Firebase project ID; set **`FIREBASE_SPARK_DEPLOY_ENABLED` to `false`** first.
7. Confirm Cloud Billing API `projects.getBillingInfo` can be called with the deploy identity and reports `billingEnabled: false` **and no billing account name**. If the API is not available or access is denied, the workflow must fail rather than skip verification.
8. Review PR CI and live release artifact. Set `FIREBASE_SPARK_DEPLOY_ENABLED` to `true` **only after** project verification, secret creation, environment rules and signoff. No tool here configured those values.
9. On subsequent relevant pushes to `main`, the CD job will run if enabled, require any configured environment approval, verify billing again, then publish only the approved static artifact to the Hosting live channel.

**Important:** The GitHub Actions workflow cannot prevent a separate Firebase administrator from later attaching a billing account or using other resources. Strict PHP 0 cloud spending depends on ongoing project-level governance and plan monitoring, not just this pipeline. The billing API check only provides point-in-time evidence before each deployment.

## Verification

Run locally from repository root:

```sh
node apps/public-site/scripts/build.mjs
node apps/public-site/scripts/verify.mjs
```

The workflow verifies exactly these four files: `index.html`, `404.html`, `robots.txt` and `styles.css` (max 512 KiB total). It does not permit arbitrary JavaScript, customer content, server rewrites, Cloud Functions, Firebase App Hosting, or a Playground build. Adding a public file requires an explicit allowlist change and code review.

The public site is a **coming-soon informational preview**, with no login or private QR/inventory functionality. Do not publish the existing user app or advertise it as operational. Real NestJS SSR and server-side QR generation remain separate backend projects.

## Incident and rollback

- Immediately set `FIREBASE_SPARK_DEPLOY_ENABLED=false` to prevent new CI deployments.
- For published bad content, use a previously reviewed Firebase Hosting release for rollback. Removing sensitive content may require cache invalidation and incident response beyond rollback.
- If billing becomes enabled, the preflight must reject the next deploy. Independently remove the billing link using appropriate administrator authorization; do not silently continue.
- If quotas approach limits, trim assets or pause the site. Do not enable Blaze to avoid downtime without a new explicit policy decision.
- Avoid unbounded preview deployments; this workflow **does not create PR Hosting preview channels**.

## Official references

- Firebase GitHub integration: https://firebase.google.com/docs/hosting/github-integration
- GitHub deployment environments: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
- Project billing verification: https://docs.cloud.google.com/billing/docs/reference/rest/v1/projects/getBillingInfo
- Firebase pricing plans: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
