# BoxVault local mock and test harnesses

This root-level `mock/` directory contains **development-only mock interfaces, browser harnesses and synthetic test fixtures**. Nothing here should be served publicly or included in production web/mobile builds.

## M1 registration tester

- File: [boxvault-m1-registration-harness.html](boxvault-m1-registration-harness.html).
- Requires the local NestJS API on `http://localhost:3000` with `NODE_ENV=development`, authentic reCAPTCHA v3 verification enabled, Brevo SMTP, and the isolated Neon `m1-security-test` branch.
- Requires a public reCAPTCHA v3 site key authorized for `localhost`. **Never paste the private reCAPTCHA secret** into the page.
- Run from repository root:

```sh
cd mock
python3 -m http.server 5173 --bind 127.0.0.1
```

- Then open `http://localhost:5173/boxvault-m1-registration-harness.html`.
- Follow Register → check Brevo inbox → Verify email → Replay rejection (401) → Login → read-only tenant-isolation checks (401/200/403).\n- To obtain the two test-only tenant UUIDs without adding a privileged API endpoint, see [tenant-isolation-readonly-lookup.md](tenant-isolation-readonly-lookup.md). The lookup requires the isolated test branch owner connection and only performs SELECTs.\n- The tester retains a successful login's access token **in the current tab memory only**; refresh or click **Forget access token** to clear it. It never prints or persists this credential.
- A successful real-provider flow is **not yet verified** just because the harness exists. Record test outcomes under [the Phase D engineering audit](../docs/audit/api/phase-d-real-provider-validation.md).

## Security rules

- Keep this directory limited to public example keys, fictional data, and source-code-only harnesses; **never commit `.env`, passwords, SMTP credentials, access tokens, verification links, real personal data, or secrets**.
- Use only the isolated test database and fresh test accounts you control. Do not test against production or the Neon default `dev` branch.
- Do not disable CAPTCHA or use CI bypasses to make the live test pass.
- The tester holds entered data in the open browser tab until the tab closes; it does not intentionally write data to browser storage.
- The harness uses the browser's Google reCAPTCHA SDK and calls the local API; browser traffic is not offline.
- No production UI or runtime application is changed by this folder.
