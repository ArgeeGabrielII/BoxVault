# BoxVault local mock assets

This folder holds **runnable local-only mock assets**, not documentation or real test data.

- [M1 registration/password/tenant-isolation browser harness](boxvault-m1-registration-harness.html) — serve at `http://localhost:5173/boxvault-m1-registration-harness.html`
- [Mock documents and usage instructions](../docs/mock/documents/README.md)
- [Mock test-data catalog and fixture boundaries](../docs/mock/data/README.md)
- [Fallback tenant UUID lookup guide](../docs/mock/documents/tenant-isolation-readonly-lookup.md)
- [Container sharing / revocation test](../docs/mock/documents/container-sharing-revocation.md) — Step 6; requires two existing active same-tenant members
- [Phase D audit / observed test outcomes](../docs/audit/api/phase-d-real-provider-validation.md)

Run the local tester with `cd mock && python3 -m http.server 5173 --bind 127.0.0.1`, with the NestJS API at `http://localhost:3000` and the isolated Neon `m1-security-test` branch. Do not deploy the HTML mock or commit any secrets, tokens, customer data, or real test credentials.
