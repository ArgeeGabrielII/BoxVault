# Mock documentation — BoxVault M1

The root-level [`mock/`](../../../mock/) directory contains **development-only mock interfaces, browser harnesses and synthetic test fixtures**. Nothing here should be served publicly or included in production web/mobile builds.

## M1 registration tester

- File: [boxvault-m1-registration-harness.html](../../../mock/boxvault-m1-registration-harness.html).
- Requires the local NestJS API on `http://localhost:3000` with `NODE_ENV=development`, authentic reCAPTCHA v3 verification enabled, Brevo SMTP, and the isolated Neon `m1-security-test` branch.
- Requires a public reCAPTCHA v3 site key authorized for `localhost`. **Never paste the private reCAPTCHA secret** into the page.
- Run from repository root:

```sh
cd mock
python3 -m http.server 5173 --bind 127.0.0.1
```

- Then open `http://localhost:5173/boxvault-m1-registration-harness.html`.
- Follow Register → Brevo email → Verify email → Replay rejection (401) → Login → read-only tenant-isolation checks (401/200/403).
- **Mock UUID convenience:** a newly created registration displays its User UUID in development; verification displays the new User UUID and personal Tenant UUID; successful login calls `GET /api/v1/auth/dev-test-context` to auto-fill User UUID, own Tenant UUID, and an unrelated existing Tenant UUID. All UUIDs are identifiers, **not passwords or access tokens**.
- **Show/Hide** controls are provided for both original password fields, verification token, password-reset token, new password, and confirmation. Treat revealed tokens as sensitive even in a local mock.
- **Change Password (tester-only UI):** enter the verified account email in the existing email field, click **Request password-reset email**, retrieve the new single-use token from Brevo, enter and confirm the new password, then click **Change password using reset token**. This calls the **existing** `/api/v1/auth/password-reset/request` (with normal reCAPTCHA action `reset`) and `/api/v1/auth/password-reset/confirm` endpoints; the production API implementation is unchanged. Successful change revokes sessions, clears the mock's in-memory bearer token, copies the new password into the existing login field, and requires a new login. The mock does not print/store passwords or raw tokens. The generic request response doesn't confirm whether the email belongs to a user.
- The test-context endpoint requires a live JWT session, loopback client, `NODE_ENV=development`, and the exact isolated `m1-security-test` direct database endpoint. It reads tenant IDs only, does not modify data, and is unavailable outside those constraints. The test helper temporarily uses the isolated branch migration-role connection: never enable it in a deployed API or point it at shared, production or default-dev databases.
- The tester retains a successful login's access token **in the current tab memory only**; refresh or click **Forget access token** to clear it. No access token is printed or persisted.
- Fallback manual lookup: [tenant-isolation-readonly-lookup.md](tenant-isolation-readonly-lookup.md). This is needed only if automatic lookup fails.
- A successful real-provider flow is not proven merely because the harness exists. Record test outcomes under [the Phase D engineering audit](../../audit/api/phase-d-real-provider-validation.md).

## Security rules

- Keep this directory limited to public example keys, fictional data, and source-code-only harnesses; **never commit `.env`, passwords, SMTP credentials, access tokens, verification links, real personal data, or secrets**.
- Use only the isolated test database and fresh test accounts you control. Do not test against production or the Neon default `dev` branch.
- Do not disable CAPTCHA or use CI bypasses to make the live test pass.
- The tester holds entered data in the open browser tab until the tab closes; it does not intentionally write data to browser storage.
- The harness uses the browser's Google reCAPTCHA SDK and calls the local API; browser traffic is not offline.
- No production UI or runtime application is changed by this folder.
