# Product Requirements Document (PRD)

**Implementation snapshot (2026-11-12; PR #4):** The MVP requirements remain the approved target, not a completed product. A NestJS authentication/tenant/RLS foundation exists on the feature branch; database phases A–C were verified on an isolated Neon test branch, and a local registration → email verification → login was observed. Family invitation/seat-limit UI, inventory CRUD, media, web-only payment processing, and native app onboarding are not accepted. A browser own-tenant read returned unexpected HTTP 403; release acceptance remains blocked. See [roadmap](../planning/delivery-roadmap.md) and [Phase D audit](../audit/api/phase-d-real-provider-validation.md).

Version 0.1 • Owner: Product/Engineering • Status: proposed

## 1. Product vision and personas

**BoxVault** lets people identify a storage box by a printed QR label or NFC tag and securely view photographic contents without opening a stacked container. The system includes a React customer website, a native SwiftUI iPhone app, a NestJS API, and an operator-only web admin portal.

Personas: **Personal owner** (single-user tenant), **Family owner** (payer, invitation and access control), **Family editor** (maintains shared boxes), **Family viewer** (read-only), **Payment reviewer** (financial decisions), **Operations admin** (business/operational metadata), **System Support** (support cases, account-status lookup and redacted diagnostics), and **Security admin** (operator identity/security governance). A member can belong to multiple tenants in the future; tenant switching must be explicit and independently authorized.

## 2. Release labels

- **MVP**: essential to commercially test the core workflow and entitlement model.
- **V1**: after pilot feedback, not required for first paid release.
- **Later**: future candidate; not a promise.
- Every feature requires screen-level loading/error/empty states, accessibility support, authorization tests and telemetry **without inventory contents**.

## 3. Identity, tenants and family

| ID | Priority | Requirement | Acceptance |
|---|---|---|---|
| ID-01 | MVP | Email registration, verification, sign-in, secure logout and password reset | Unverified identities cannot access protected operations; sessions can be revoked |
| ID-02 | MVP | Create personal/family tenant on registration | Tenant owner and initial membership created atomically; no cross-tenant reads |
| ID-03 | MVP | Family owner invites members by email; invite links single-use and expiring | Seat cap enforced at **4 total members including owner**; duplicate/pending invitations handled |
| ID-04 | MVP | Roles OWNER, EDITOR, VIEWER; platform ADMIN separate from tenant roles | Unauthorized mutations and reads denied at both application and database layers |
| ID-05 | MVP | Profile, password change, active-device/session management | Session revocation takes effect; credentials never logged |
| ID-06 | V1 | Personal/private boxes inside a family | Only explicitly authorized members can read, even if other members share tenant |
| ID-07 | V1 | Member removal, ownership transfer and tenant switching | Removed member's refresh tokens revoked; access denied before any inventory responses |
| ID-08 | V1 | Account data export/deletion and tenant closure | Export is authenticated, time-limited; retention exceptions documented |

## 4. Locations, containers and scanning

| ID | Priority | Requirement | Acceptance |
|---|---|---|---|
| INV-01 | MVP | Create/edit/archive a container with name and optional description | A tenant can see only its containers; subscription quotas enforced server-side |
| INV-02 | MVP | Locations: property, room, rack/shelf, custom path | Boxes can be moved between locations without changing tag identity |
| INV-03 | MVP | Generate downloadable/printable QR label containing an opaque container URL/token | No title, customer identity, inventory content or predictable database ID embedded |
| INV-04 | MVP | Scan QR using native iPhone camera; browser scanning where available | Signed-out scanning requests sign-in; unauthorized scan reveals no private metadata |
| INV-05 | MVP | Open secure container page from supported HTTPS URL / iOS Universal Link | Deep link preserves pending target through auth without bypass |
| INV-06 | MVP | NFC NDEF URL tags: read/open container via compatible iOS device | Same authorization as QR; NFC possession is never identity |
| INV-07 | V1 | Write/replace NFC tag with native Core NFC flow | Capability checks, supported tag/error handling and confirmation before overwrite |
| INV-08 | V1 | Reprint/rotate/revoke damaged, lost or shared label | Old token invalidated and audited; duplicate-label handling documented |
| INV-09 | V1 | Bulk label print layouts and import/export of containers | Document templates do not embed protected content |
| INV-10 | V1 | Container status, tags and activity history | Status history records actor and timestamp; no sensitive payloads in ops logs |

## 5. Photos, inventory and search

| ID | Priority | Requirement | Acceptance |
|---|---|---|---|
| MED-01 | MVP | One quick overview photo is sufficient to save a container | User not forced to create an item record for every object |
| MED-02 | MVP | Multiple detailed photos per container/item | Upload MIME/magic-byte/size validation; media private; ownership verified |
| MED-03 | MVP | Client compression + server thumbnails and image metadata | EXIF location removed by default; downloads authorized; quotas use actual stored bytes |
| INV-11 | MVP | Add/edit/remove inventory items with name, quantity, notes and optional image | Quantity nonnegative or explicitly controlled; list supports zero/empty states |
| INV-12 | MVP | Find by item name, category, container name and location; filter/sort | Search is tenant scoped, including suggestions and counts |
| INV-13 | MVP | View container collage/overview photo, item tiles and last-updated date | Only authorized images visible; no public bucket access |
| INV-14 | V1 | Move items between boxes, bulk actions and soft-delete restore | Changes atomic, audit event emitted, ownership checked |
| INV-15 | V1 | Offline read cache and queued media capture on iOS | Cached data encrypted/protected; invalidated on logout/member removal |
| INV-16 | Later | AI-assisted photo item suggestions, subject to user opt-in | User confirms suggestions; AI service never receives content without notice and consent |
| INV-17 | Later | Barcode recognition, CSV imports and advanced analytics | Privacy reviewed before launch |

## 6. Web customer portal

| ID | Priority | Requirement |
|---|---|---|
| WEB-01 | MVP | Responsive React inventory dashboard and label/print management |
| WEB-02 | MVP | Account and family management, invitations, roles and plan entitlement |
| WEB-03 | MVP | Web-only credits purchase request, bank QR instructions, reference and receipt upload |
| WEB-04 | MVP | View wallet ledger, payment-request history, redemption history and annual plan status |
| WEB-05 | MVP | Redeem sufficient credits to activate or renew a plan; explicit confirmation |
| WEB-06 | V1 | Web-based media bulk upload, exports and self-service billing dispute flow |

## 7. Native iOS app

| ID | Priority | Requirement |
|---|---|---|
| IOS-01 | MVP | Native SwiftUI home, sign-in/out, sessions stored in Keychain |
| IOS-02 | MVP | AVFoundation QR scan and secure deep-link resolution |
| IOS-03 | MVP | Capture/upload/view inventory photos; edit boxes/items within role |
| IOS-04 | MVP | Search/browse folders, containers and item thumbnails |
| IOS-05 | MVP | Core NFC read of supported NDEF labels; Universal Link handling |
| IOS-06 | MVP | Family invite acceptance and **neutral** plan expiration/status display |
| IOS-07 | V1 | Native NFC tag writing and offline reads |
| IOS-08 | MVP | **No** in-app payment, pricing packages, credit wallets, bank QR, receipt uploads, browser checkout links or calls to action for external purchasing |

**App Store caveat:** Web-only sales do not by themselves make digital subscriptions exempt from Apple's payment rules. Confirm suitability for an applicable free companion-app exception and review current guidelines prior to App Store submission.

## 8. Web admin/operator portal

**2026-11-13 role update:** System Support is a separate `SYSTEM_SUPPORT` role design with its own mock workspace. It may triage/escalate cases and inspect safe status/correlation metadata; it cannot read inventory, approve payments, edit credits/plans, impersonate users or assign roles. See the [all-role sitemap](../experience/role-sitemap.md). Live backend role enablement remains future work.

| ID | Priority | Requirement | Guardrail |
|---|---|---|---|
| ADM-01 | MVP | Global metrics: paying tenants, members, active/expired plans, new/inactive accounts | No inventory titles, photos, notes or search |
| ADM-02 | MVP | Pending top-ups queue, proof review, verified bank reference, approve/reject | Two-step confirmation; duplicate-check and audit |
| ADM-03 | MVP | Income by week/month/year, by plan and channel; refunds/reversals, unused credits | Distinguish **cash collected**, **credits issued/redeemed** and **earned revenue** |
| ADM-04 | MVP | Subscription detail, plan dates, renewal, history and status changes | Support views limited to necessary account/billing metadata |
| ADM-05 | MVP | Error dashboards: correlation ID, endpoint, safe error code, duration, event timestamps | No request bodies, inventory content, image URLs/tokens or payment proofs in logs |
| ADM-06 | V1 | Cohort, retention, renewal and inactive-user reporting, opt-in win-back segments | Respect consent, unsubscribe and retention rules |
| ADM-07 | V1 | Manual adjustments/reversals with reason, actor and optional second approver | Append-only ledger; prohibit silent balance edits |
| ADM-08 | MVP | Role-separated operator and security-admin actions with audit trail | Admin UI and API have no general inventory read capability |

## 9. Plan rules and limits

| Plan | Monthly price (billed monthly) | Annual price (billed annually) | Users per tenant | Container limit | Media storage |
|---|---:|---:|---|---|---|
| Free User | PHP 0 | PHP 0 | Not finalized | Limited; exact cap not specified | Not finalized |
| Single User (Personal) | PHP 119 | PHP 999 — **Best Value** | 1 | 30 (previous planning assumption) | 1 GB (proposed) |
| Family User | PHP 219 | PHP 1,999 | 4 **including owner** | 150 (previous planning assumption) | 5 GB (proposed) |

**2026-11-13 pricing preview update:** Free User is advertisement-supported. No numeric Free container cap is approved, and ad delivery is not connected. Monthly and annual prices above are reflected in the shared mock plan catalog; billing and entitlement enforcement remain future backend work.

Plan prices and member cap are agreed product decisions. Container/storage limits are **planning assumptions**, not finalized quotas. Credits are purchased and redeemed on the **web only**. A renewed plan should extend from `max(now, current_expiry)` when renewing the same plan, preventing loss of unused time.

Define precise expired-plan behavior before launch: suggested **read-only grace access + export**, with uploads disabled. Do not immediately delete inventory on expiration.

## 10. Customer journeys

1. **Onboarding**: register → verify email → create tenant → choose membership model → web top-up/redeem → inventory available.
2. **Label a box**: create container → photo → optional items → assign location → generate QR or provision NFC URL → attach label.
3. **Find a stored object**: search text or scan → authorize user+tenant → open preview → view item and container location.
4. **Family member**: owner sends invite → recipient registers/signs in → role and seat cap checked → member sees shared data.
5. **Manual payment**: web top-up request → external transfer → submit reference/proof → admin verifies actual incoming transfer → credit ledger posts → customer explicitly redeems → entitlement active.
6. **Support**: user supplies support ID/correlation ID → operator sees safe diagnostics and subscription metadata only.

## 11. Non-functional requirements (initial targets)

- Isolation: **zero successful unauthorized cross-tenant reads/writes** in automated authorization tests.
- API p95 latency target: under 500 ms for lightweight authenticated metadata requests under agreed pilot load, excluding media transfer.
- Availability goal: target 99.5% monthly for initial production once backup/recovery and network architecture are validated; not an existing SLA.
- Uploads: resumable or retryable for unreliable mobile networks, strict byte limits and explicit progress.
- Time: store UTC; display local times, and report billing periods in **Asia/Manila** consistently.
- Accessibility: scalable text, screen reader labels, high-contrast UI and QR manual-lookup fallback.
- Reliability: idempotent uploads where practical, idempotent financial actions mandatory.
- Privacy: operational logging cannot leak inventory; admin cannot browse private media.
- Costs: meter storage bytes and downloads per tenant without examining image contents.

## 12. Out of scope for MVP

Public marketplace, payment gateway integration, peer-to-peer credits transfer, cash withdrawals, Android native client, public anonymous box sharing, AI scanning, advanced end-to-end encryption, business warehouse features, and custom physical hardware.

## 13. Open acceptance gates

- Payment/registration compliance and App Store review posture confirmed.
- Auth, tenant RBAC, PostgreSQL RLS and signed-media authorization tested.
- Dual operator approval or adequate controls for bank transfer verification and ledger integrity.
- Backup restoration and incident handling drills successful.
- Price/limit policy and marketing consent validated before collecting real customer data.
