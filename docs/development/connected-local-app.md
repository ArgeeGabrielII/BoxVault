# Connected local BoxVault

Updated 2026-11-18 (Asia/Manila). This is the first connected local account/inventory/QR workflow. The Firebase site continues to publish the separate mock build; no hosted API or Neon database is changed by these commands.

## Start and use

Requirements: Node 22, pnpm 10.18, PostgreSQL 18 server tools. The launcher discovers `pg_config` or the Homebrew PostgreSQL 18 installation. Dependencies must be installed once.

```bash
pnpm install --frozen-lockfile
pnpm dev:local
```

Open **http://127.0.0.1:5180**.

1. Choose **Create an account**. Use an email address and a password with 12+ characters, uppercase, lowercase and a number.
2. Open **Local inbox**, then the verification action. Choose/confirm your password and sign in.
3. Choose **New box**, enter a name/location, open the saved box and add inventory items.
4. Choose **Create / replace QR label**. Download SVG or PNG before closing the dialog. **Test label** opens the authenticated resolution flow. Replacing a label invalidates earlier copies; the server stores only the locator hash and cannot redisplay the original proof.
5. In **Family**, choose **Enable local Family** to try the four-person workflow without a purchase. Invite a second account, verify it, sign in as that recipient and accept the invitation from its local inbox. Personal and shared workspaces remain selectable separately.
6. Open a box to choose PRIVATE, ALL_FAMILY, or selected-member sharing. Selected-member selection currently uses the workspace owner's directory; an Editor who owns a box can choose PRIVATE/ALL_FAMILY. No implicit access to another creator's private box is granted.
7. Use **Settings** for authenticator setup, recovery codes and session revocation. Password reset messages also arrive in Local inbox.

Use a private window or another browser profile for a second account: ordinary tabs share refresh cookies. Credential-free cross-tab messages clear stale signed-in views when an account is changed or explicitly signed out. Verification/reset/label proofs are captured from fragments into memory and removed from the address bar.

This is a loopback app: phone QR readers cannot open `127.0.0.1` on your computer. Test the label in the desktop browser or paste its URL into **QR labels → Open a label**. A phone-accessible deployment requires the later HTTPS API/frontend hosting phase.

## Persistent local data and stopping

The launcher creates **`.boxvault-local/` in the repository root** (ignored by Git):

- PostgreSQL data files and local mail, retained across restarts.
- A private `config.json` with generated local database passwords and signing/encryption keys; file mode 0600, parent directory 0700.
- API, web, SMTP and PostgreSQL logs, inside that private directory.

Press **Ctrl+C** in the launcher terminal to stop its services. Run `pnpm dev:local` again to resume the same accounts and inventory. Do not delete the data directory to restart: deleting it removes your local data and keys. PostgreSQL-native backups/export are not yet surfaced in the UI.

Defaults: web 5180, API 4380, PostgreSQL 5580, SMTP 2580, all literal loopback. The launcher refuses busy ports, uses its own private cluster, and never reads application `.env` files or a supplied hosted `DATABASE_URL` to choose a migration target. It does not attach billing, create cloud services or send external email. `BOXVAULT_LOCAL_STATE` selects a different private local directory for isolated tests; ports are stored with that directory's configuration.

This local profile intentionally uses `NODE_ENV=test` and the existing test-only CAPTCHA-off path. A synthetic loopback SMTP sink delivers messages to the local inbox instead of the internet. The API is forced to loopback in test mode. Local inbox is a developer facility that can access messages for all accounts in this private local sandbox, not a production mailbox or account-security boundary between people using the same computer.

## Connected surface

| Area | Working local flow |
| --- | --- |
| Accounts | Registration, recipient-controlled verification, password sign-in, reset, HttpOnly-cookie refresh, logout |
| Security | MFA challenge/setup/confirmation, one-time recovery codes, recovery rotation, MFA disable, session list/revocation |
| Workspaces / Family | Own memberships, owner-managed invites/cancellation/roles/removal, verified acceptance, four-seat enforcement and immediate revocation |
| Boxes | Saved private creation, name/location editing, authorized listing/detail, server-provided editing capabilities and visible item counts |
| Items | Add/edit/remove, validated nonnegative integer quantity, role/ACL intersections |
| QR | Authenticated creator-only issuance/rotation, SVG/PNG generation, signed-in locator resolution with tenant/object RLS |

Photo upload/private storage, full location hierarchy, deletion/archive/restore, global inventory search, Google OAuth configuration, wallets/payments, real operator workflows and iOS integration are not completed by this phase. The connected UI does not simulate successful payments or admin operations. General production plan/quota enforcement, backups, release review and deployment remain separate acceptance gates.

## Architecture and safeguards

- The connected React entrypoint is `apps/web/connected`, with its own Vite config and `dist-connected` output. It uses real API state; it imports no mock customer records.
- Requests use the same-origin `/api/v1` proxy. Access JWT stays in memory; refresh cookie stays HttpOnly. Concurrent expired requests share a single refresh. Wrong MFA codes remain form errors. Account switches invalidate stale in-flight workspace results.
- Local mailbox and sandbox Family activation are Node-only development middleware, enabled only with the explicit local profile, test mode, validated loopback origins and an allowlisted local database. Family activation verifies the caller's real owner membership through the API before a local-only entitlement fixture is written; it never grants credits or accepts a payment.
- Private local state is denied by Vite's file-serving rules. Local middleware rejects foreign Origins and non-loopback requests. It is not bundled into either static output.
- The public Firebase build remains at `apps/web/dist`, with its existing network-blocking CSP and artifact audits. The connected entrypoint is never selected by the Firebase deployment workflow.
- New private APIs are guarded and use the existing same-transaction tenant context/advisory locks/RLS. Label possession is not authorization. Newly issued locator values are SHA-256 hashed in the existing unique `Container.publicToken` field. No schema migration or existing-row conversion is needed; earlier unissued scaffold values do not resolve through the new hashed resolver.
- `LABEL_ROTATED` is recorded through the existing allowlisted account audit without raw locator or content; it is not a cross-database atomic financial ledger. Inventory/label audit granularity remains part of production review.
- All API responses and client requests disable caching. Verification/reset/invitation/scan URLs use fragments, not query parameters. No analytics is installed in the connected entrypoint.

## Verification

- Connected frontend build/typecheck and four client-session regression tests.
- `node scripts/test-connected.mjs`: black-box HTTP through the same-origin web proxy; signup → local mail → verify → password login → name/location + items → QR issuance/rotation → outsider denial → Family acceptance → shared view/role ceiling → revocation → reset → refresh/logout. Also checks foreign-Origin denial and private-file protection.
- Existing auth, MFA, onboarding, CAPTCHA and Family/RLS suites remain in CI. The connected HTTP flow runs after them against disposable PostgreSQL and synthetic SMTP, not Neon.
- Persistent record counts were compared before and after stopping/restarting the local cluster. No live provider credentials or real customer data were used.
- Browser interaction and screenshot QA were unavailable in this session. Build and HTTP checks do not substitute for user/device acceptance.

**Engineering implementation and automated evidence are separate from production acceptance.** No cloud runtime, hosted migration, public launch or paid-customer approval is claimed.
