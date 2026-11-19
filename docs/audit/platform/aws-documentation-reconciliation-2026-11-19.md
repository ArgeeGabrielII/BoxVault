# AWS documentation reconciliation — 2026-11-19

## Scope and outcome

AWS is the accepted primary SaaS platform under [ADR-AWS-001](../../architecture/aws-platform-decision.md). The reviewed documentation uses Sydney, one API host, private Single-AZ RDS, S3, SES and daily credential rotation. Auto Scaling and Multi-AZ are deferred. The [rotation policy](../../deployment/secret-rotation.md) records the undeployed managed-master schedule and the outstanding runtime-user/key-version implementation.

This is documentation/source evidence, not production acceptance. Only toolkit IAM access is deployed. AWS application infrastructure, fresh database schema/grants, hosted email/UI, uploads, runtime secret refresh, alarms and live rotation remain unfinished. Neon and Brevo are explicitly retired from the active stack, replaced by RDS PostgreSQL and SES with no fallback. Existing local/Neon data and Firebase mock/Playground previews are preserved. Provider-resource closure and old credential revocation remain a separate reviewed task. The AWS database starts empty.

Current architecture, operations, development, product, security and roadmap text was reconciled. Dated audits retain their original commands/results/commit references with historical context. Legacy provider guides remain isolated references; they are not the default AWS setup. Prices, the four-seat Family cap and web-only purchasing remain unchanged.

## Verification

- Repository-relative Markdown links checked; broken engineering/playground references corrected.
- Dated evidence bodies compared against the preceding source commit, excluding the added platform note and blank-line normalization.
- RDS draft inspected for `MultiAZ: false`, no Auto Scaling group, and `rate(1 day)` with a one-hour rotation window. Prior AWS `ValidateTemplate` success is syntax evidence only.
- `git diff --check` used for whitespace validation. No application behavior changed in this documentation reconciliation; previously recorded tests retain their original scope.
- No secret values were retrieved or changed. No application resources were provisioned and no traffic was cut over.

## Reviewed document inventory

68 existing documentation files were reviewed, plus this record.

| Document | Treatment |
| --- | --- |
| [README.md](../../../README.md) | current platform/security references reconciled |
| [apps/api/src/security/README.md](../../../apps/api/src/security/README.md) | current platform/security references reconciled |
| [apps/ios/README.md](../../../apps/ios/README.md) | current platform/security references reconciled |
| [docs/README.md](../../README.md) | current platform/security references reconciled |
| [docs/architecture/api-contract.md](../../architecture/api-contract.md) | current platform/security references reconciled |
| [docs/architecture/architecture.md](../../architecture/architecture.md) | current platform/security references reconciled |
| [docs/architecture/aws-platform-decision.md](../../architecture/aws-platform-decision.md) | authoritative platform decision |
| [docs/architecture/data-model.md](../../architecture/data-model.md) | current platform/security references reconciled |
| [docs/architecture/solution-architecture.md](../../architecture/solution-architecture.md) | current platform/security references reconciled |
| [docs/audit/README.md](../README.md) | current platform/security references reconciled |
| [docs/audit/TEMPLATE.md](../TEMPLATE.md) | current platform/security references reconciled |
| [docs/audit/api/id03-family-membership.md](../api/id03-family-membership.md) | historical evidence preserved; current-platform context added |
| [docs/audit/api/m1-implementation.md](../api/m1-implementation.md) | historical evidence preserved; current-platform context added |
| [docs/audit/api/phase-d-real-provider-validation.md](../api/phase-d-real-provider-validation.md) | historical evidence preserved; current-platform context added |
| [docs/audit/assets/m1-shared-assets.md](../assets/m1-shared-assets.md) | historical evidence preserved; current-platform context added |
| [docs/audit/database/phase-a-history-adoption.md](../database/phase-a-history-adoption.md) | historical evidence preserved; current-platform context added |
| [docs/audit/database/phase-b-schema-deployment.md](../database/phase-b-schema-deployment.md) | historical evidence preserved; current-platform context added |
| [docs/audit/database/phase-c-identity-grants.md](../database/phase-c-identity-grants.md) | historical evidence preserved; current-platform context added |
| [docs/audit/mobile/m1-integration.md](../mobile/m1-integration.md) | historical evidence preserved; current-platform context added |
| [docs/audit/platform/m1-ci-and-release-gates.md](m1-ci-and-release-gates.md) | historical evidence preserved; current-platform context added |
| [docs/audit/web/m1-registration-ui.md](../web/m1-registration-ui.md) | historical evidence preserved; current-platform context added |
| [docs/deployment/aws-agent-toolkit.md](../../deployment/aws-agent-toolkit.md) | current platform/security references reconciled |
| [docs/deployment/aws-migration.md](../../deployment/aws-migration.md) | current platform/security references reconciled |
| [docs/deployment/aws-service-map.md](../../deployment/aws-service-map.md) | current platform/security references reconciled |
| [docs/deployment/secret-rotation.md](../../deployment/secret-rotation.md) | current platform/security references reconciled |
| [docs/developer-playground.md](../../developer-playground.md) | current platform/security references reconciled |
| [docs/development/connected-local-app.md](../../development/connected-local-app.md) | current platform/security references reconciled |
| [docs/development/development.md](../../development/development.md) | current platform/security references reconciled |
| [docs/development/m1-neon-free-tier-validation.md](../../development/m1-neon-free-tier-validation.md) | legacy reference retained; primary/default scope corrected |
| [docs/development/m1-neon-reconciliation-audit-2026-11-12.md](../../development/m1-neon-reconciliation-audit-2026-11-12.md) | legacy reference retained; primary/default scope corrected |
| [docs/development/neon-agent-skills-mcp.md](../../development/neon-agent-skills-mcp.md) | legacy reference retained; primary/default scope corrected |
| [docs/development/neon-connection.md](../../development/neon-connection.md) | legacy reference retained; primary/default scope corrected |
| [docs/experience/admin-preview.md](../../experience/admin-preview.md) | current platform/security references reconciled |
| [docs/experience/role-sitemap.md](../../experience/role-sitemap.md) | current platform/security references reconciled |
| [docs/experience/web-experience-seo-compliance.md](../../experience/web-experience-seo-compliance.md) | current platform/security references reconciled |
| [docs/firebase-spark-cicd.md](../../firebase-spark-cicd.md) | current platform/security references reconciled |
| [docs/firebase-spark-deployment-plan.md](../../firebase-spark-deployment-plan.md) | superseded provider ADR retained and clearly labelled |
| [docs/mock/README.md](../../mock/README.md) | legacy reference retained; primary/default scope corrected |
| [docs/mock/data/README.md](../../mock/data/README.md) | legacy reference retained; primary/default scope corrected |
| [docs/mock/documents/README.md](../../mock/documents/README.md) | legacy reference retained; primary/default scope corrected |
| [docs/mock/documents/container-sharing-revocation.md](../../mock/documents/container-sharing-revocation.md) | legacy reference retained; primary/default scope corrected |
| [docs/mock/documents/tenant-isolation-readonly-lookup.md](../../mock/documents/tenant-isolation-readonly-lookup.md) | legacy reference retained; primary/default scope corrected |
| [docs/operations/operations-and-deployment.md](../../operations/operations-and-deployment.md) | current platform/security references reconciled |
| [docs/planning/delivery-roadmap.md](../../planning/delivery-roadmap.md) | current platform/security references reconciled |
| [docs/planning/milestone-01-security-foundation.md](../../planning/milestone-01-security-foundation.md) | current platform/security references reconciled |
| [docs/product/credits-and-subscriptions.md](../../product/credits-and-subscriptions.md) | current platform/security references reconciled |
| [docs/product/family-sharing-access-control.md](../../product/family-sharing-access-control.md) | current platform/security references reconciled |
| [docs/product/product-requirements.md](../../product/product-requirements.md) | current platform/security references reconciled |
| [docs/qr-library-architecture.md](../../qr-library-architecture.md) | current platform/security references reconciled |
| [docs/qr-library-implementation.md](../../qr-library-implementation.md) | current platform/security references reconciled |
| [docs/security/authentication-google-mfa-captcha.md](../../security/authentication-google-mfa-captcha.md) | current platform/security references reconciled |
| [docs/security/critical-authorization-e2e-tests.md](../../security/critical-authorization-e2e-tests.md) | current platform/security references reconciled |
| [docs/security/dependency-remediation-2026-11-18.md](../../security/dependency-remediation-2026-11-18.md) | historical evidence preserved; current-platform context added |
| [docs/security/github-alert-review-2026-11-18.md](../../security/github-alert-review-2026-11-18.md) | historical evidence preserved; current-platform context added |
| [docs/security/m1-authentication-hardening.md](../../security/m1-authentication-hardening.md) | historical evidence preserved; current-platform context added |
| [docs/security/m1-authentication-implementation.md](../../security/m1-authentication-implementation.md) | historical evidence preserved; current-platform context added |
| [docs/security/m1-security-gate-status.md](../../security/m1-security-gate-status.md) | historical evidence preserved; current-platform context added |
| [docs/security/m1-token-bound-onboarding.md](../../security/m1-token-bound-onboarding.md) | historical evidence preserved; current-platform context added |
| [docs/security/security-and-privacy.md](../../security/security-and-privacy.md) | current platform/security references reconciled |
| [docs/security/security-first-standard.md](../../security/security-first-standard.md) | current platform/security references reconciled |
| [docs/security/security-release-checklist.md](../../security/security-release-checklist.md) | current platform/security references reconciled |
| [docs/web-ui-redesign-plan.md](../../web-ui-redesign-plan.md) | current platform/security references reconciled |
| [infrastructure/README.md](../../../infrastructure/README.md) | current platform/security references reconciled |
| [mock/README.md](../../../mock/README.md) | legacy reference retained; primary/default scope corrected |
| [packages/assets/README.md](../../../packages/assets/README.md) | current platform/security references reconciled |
| [packages/config/README.md](../../../packages/config/README.md) | current platform/security references reconciled |
| [packages/contracts/README.md](../../../packages/contracts/README.md) | current platform/security references reconciled |
| [packages/qr/README.md](../../../packages/qr/README.md) | current platform/security references reconciled |

## Related configuration

The root/API/web `.env.example` comments now distinguish hosted AWS placeholders from the loopback launcher and disconnected static build; they contain no deployed credentials. Project `AGENTS.md` and Kiro steering preserve the restricted toolkit identity and add the accepted platform/rotation preferences. The existing `infra/aws` drafts and read-only readiness script remain preparation for a separately authorized deployment.

Release acceptance still requires current scoped CI, real AWS/provider/browser/device exercises, successful rotations over two scheduled windows, failure recovery, restore validation and the required security/operational sign-off. Passing CI alone does not close these gates.
