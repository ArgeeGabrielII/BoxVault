# CloudFront verification request — BoxVault

Observed 2026-11-19 (Asia/Manila). Application deployment is blocked by AWS project verification, independently of IAM permissions. Keep the Free plan; do not upgrade, activate advanced features or create another project as a workaround.

## Send through AWS Support

Open [AWS Support](https://console.aws.amazon.com/support/home#/) while signed into the project owner’s browser session. Choose account/project assistance for CloudFront verification. The exact categories shown can vary. This draft is prepared for the owner; no support case has been submitted by the agent.

Subject: CloudFront resource creation blocked by project verification (Free plan)

```text
Hello AWS Support,

Please review the CloudFront verification restriction on my AWS project.

Project/account ID: 666734238831
Experience: new project-based AWS experience
Plan: FREE / ACTIVE
Selected Region: ap-southeast-2 (Sydney)
Application: BoxVault, a small prototype using included Free-plan credits

CloudFormation attempted to create AWS::CloudFront::Distribution for the
isolated static Developer Playground and returned this message:

Your account must be verified before you can add new CloudFront resources.
To verify your account, please contact AWS Support and include this error message.

CloudFront request ID: 440d924a-e4f1-4aed-a611-bc09d487a14a
HTTP status: 403
Date: 2026-11-19
Logical resource: PlaygroundDistribution

Please confirm which verification steps are required and enable eligible
CloudFront resource creation once verification is complete. I must remain
on the Free plan using included credits. I do not authorize a paid-plan
upgrade, advanced-feature activation, a paid support subscription or charges.

Thank you.
```

Never include access keys, browser login tokens, password/secret values or verification-email links in the case. AWS lists CloudFront among the new-experience Free-plan services; the observed error specifically requests verification, not a plan upgrade. The service’s response is authoritative for this project.

## Deployment checkpoint

- Temporary cfn-guard installation and downloaded rules were removed after both templates passed the selected checks.
- The temporary concurrency probe was removed; the owner approved the existing shared five-execution quota.
- Separate deployment/toolkit roles and the verified individual SES sender remain.
- The owner requested removal of unused application resources after the verification block. Application/artifact stacks, uploaded artifact versions, empty buckets and the unused generated app secret were removed and their absence verified; recheck the inventory before retry. The separate access roles and SES identity remain.
- No RDS database or interface endpoint existed in the post-failure inventory. Final cleanup verified zero app networks, RDS instances, endpoints, functions and log groups.
- The API has not been enabled; no live registration, migration or daily rotation acceptance is claimed.

After AWS confirms verification, recheck FREE/ACTIVE, credits/expiry, permissions and the final rollback state. After cleanup, rebuild/upload the artifact and provision a fresh app secret and empty database using a fresh change set; resume the private migration/security/HTTPS/rotation checks in [the deployment checkpoint](aws-free-plan-deployment.md). Do not enable database/endpoints solely to wait for CloudFront verification.
