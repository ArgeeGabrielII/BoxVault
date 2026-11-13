# Security, Tenant Isolation and Privacy Specification

**Implementation snapshot (2026-11-12; PR #4):** This document defines mandatory security policy. Its M1 implementation includes auth/MFA/session safeguards, restricted database roles, and tenant/container ACL-aware RLS. Isolated test-branch DB permissions and scoped CI have recorded evidence; full current-head CI, web/iOS integration, all authenticated cross-tenant/media/QR/finance negative tests, operator provisioning, key/secret operations and independent security review are **not accepted**. The legacy overprivileged test auth role is an outstanding risk. See [security gates](m1-security-gate-status.md) and [roadmap](../planning/delivery-roadmap.md).

Status: design requirements; not a claim of deployed security controls.

## 1. Trust model and protected data

Protected customer content includes container/item names, locations, descriptions, photos and family membership. Billing-sensitive data includes bank references, payment proofs, top-up transactions and wallet balances. Account/operational metadata should be minimized and role-scoped. Mobile devices, browsers, QR labels, NFC tags, household networks and uploaded files are **untrusted** inputs.

Platform operator access to invoices, subscription status, account activity and safe logs **does not** imply permission to view inventory.

## 2. Threats and mitigations

| Threat | Requirement |
|---|---|
| URL/QR enumeration | Cryptographically random token; token rotation/revocation; no inventory in label |
| Tenant ID tampering / IDOR | Resolve membership server-side; object authorization; PostgreSQL RLS |
| Photo URL disclosure | Private buckets, short-lived URLs, safe cache policies, access checks |
| Family member escalation | Role checks on every route; transactional seat limit; revoke sessions after removal |
| Credential theft | Argon2id with current tuning, email verification, rate limits, optional MFA, secure refresh |
| Refresh token replay | Rotated hashed tokens, device sessions and reuse detection |
| Receipt fraud | Actual bank credit independently checked; verified reference and duplicate controls |
| Double credit on retries | Row locks/serializable transactions + unique source event/idempotency |
| Log exfiltration | No raw payload logging; field allowlist, short retention, protected log access |
| Insider admin browsing | No content API scopes, separate DB roles and storage IAM, audited maintenance |
| Home server compromise | OS hardening, secrets vault, isolated VLAN, patched services, encrypted backups |
| Ransomware / disk corruption | Tested immutable/off-site backups and restoration |
| Upload attacks | MIME signature validation, virus/scanning where feasible, size/pixel limits, image re-encode |
| Lost/stolen phone | Keychain, session revocation, local cache encryption and logout purge |

## 3. Permissions matrix

| Resource | Owner | Editor | Viewer | Platform admin |
|---|---|---|---|---|
| Shared box metadata/photos | Read/write | Read/write | Read | **None** |
| Invite/remove member | Yes | No | No | None |
| View own plan entitlement | Yes | Neutral status | Neutral status | Subscription metadata only |
| Submit web top-up / redeem | Yes | No | No | No |
| Review incoming bank payment | No | No | No | Limited finance role |
| Business aggregate reporting | No | No | No | Authorized operational role |
| Safe troubleshooting events | Own support reference only | Own support reference only | Own support reference only | Authorized operations role |

A future private-box ACL can further narrow members' access inside a family.

## 4. Database, storage and admin isolation

- Runtime DB service account must not have `BYPASSRLS` or migration/ownership privileges. Create dedicated migration DB role.
- All tenant rows use RLS, `WITH CHECK` and `USING`; set local tenant context inside transaction after trusted membership resolution.
- Run tests for Prisma transactions, pooled connections and nested relations (including counts/search).
- App admin endpoints run with a role that cannot query inventory or photo tables. There must not be a hidden unrestricted `GET /admin/inventory`.
- Media bucket access is through a dedicated service identity; admin web account cannot list/download objects.
- Infrastructure owners with DB superuser, backup or server filesystem access may still technically read data. **Do not say 'even we cannot read it'** unless end-to-end encryption and key custody make that verifiably true.
- Consider client-side E2EE and family key-sharing as a separate, high-complexity future ADR.

## 5. Authentication/session policy

Access token: short lifetime (e.g. 5–15 minutes). Refresh tokens: random, hashed server-side and rotated. Browser: HttpOnly, Secure cookies and appropriate SameSite/CSRF controls; iOS: Keychain and ASWebAuthenticationSession or approved native sign-in. Reauthentication for financial/admin actions. Do not embed secrets in compiled iOS/web client. Enforce server-side device/session revocation.

## 6. Logging, analytics and customer privacy

Allowed: correlation ID, anonymized tenant identifier, authenticated actor ID where required for audit, route name/template, status, duration, resource count, storage bytes, credit amount, plan code, timestamps. **Not allowed:** photo bytes, thumbnail content, container or item titles, inventory notes, QR raw tokens, NFC payloads, credentials, payment proof contents, bank account numbers, full API payloads or signed storage URLs.

Troubleshooting should use synthetic reproduction or user-consented, explicitly scoped diagnostics rather than granting the operator inventory access. Minimize marketing data; require consent where applicable and respect unsubscribes.

## 7. Cryptography, retention and incident response

- TLS for every public connection; private internal services restricted by network policy and credentials.
- Encryption at rest for database, disks and off-site backup objects; encrypted secrets with rotation.
- Separate retention schedules for active media, deleted media, audit events, receipts and legally retained financial documents.
- Offer authenticated export, deletion request and account closure pathways; account deletion must not silently erase legally required transaction records.
- Document Philippine Data Privacy Act obligations, data subject rights, breach response and retention decisions. Obtain legal/organizational review before launch.
- Incident runbook: detect → isolate → preserve minimal evidence → scope → recover → evaluate notice obligations → postmortem.

## 8. Release security gate

No production customer upload, payment approval or subscription sale until:
1. Two-tenant authorization test suite is green for every inventory/media endpoint.
2. RLS enforced under production runtime DB role; migration role separate.
3. Authentication rate limiting, session rotation and secret handling tested.
4. Duplicate approval/concurrent redemption tests pass.
5. Upload validation, private media access and signed URL controls verified.
6. Encrypted off-site recovery test successful.
7. Log scrubbing, operator roles, retention and incident plans reviewed.
8. Applicable App Store and Philippine registration/payment rules checked.
