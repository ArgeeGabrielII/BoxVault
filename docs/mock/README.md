# Mock resources

Mock documentation and data definitions are deliberately separated from executable test assets.

| Location | Purpose |
|---|---|
| [documents/](documents/README.md) | Local M1 tester instructions, login, registration, verification, password change, tenant isolation, fallback UUID lookup and [container sharing/revocation](documents/container-sharing-revocation.md) |
| [data/](data/README.md) | Synthetic test-data dictionary, historical fixture counts, test expectations and data-handling rules |
| [root mock HTML](../../mock/boxvault-m1-registration-harness.html) | Executable localhost browser harness; **not** deployed |
| [Phase D audit](../audit/api/phase-d-real-provider-validation.md) | Observed results, failures, security gates and follow-up evidence |

The `/docs/mock/` tree is documentation only. Keep runnable assets in `/mock/` and production artifacts in their respective apps; do not commit real credentials, tokens, or user data.
