# M1 security boundary integration contract

This is an **internal authorization boundary**, NOT a completed authentication system. No protected inventory controller is wired yet.

## Verified access principal

`TenantBoundaryService.withAuthorizedTenant(principal, tenantId, fn)` now requires a `VerifiedPrincipal` created exclusively by an **authenticated server-side guard**. Its underlying auth service must verify access credential authenticity, expiry, refresh-session revocation and required MFA using a **separate least-privileged auth database identity**.

The `VerifiedPrincipal` interface is TypeScript-only, **not an unforgeable security token**. Never deserialize it directly from a client request. Until the real guard exists, do not expose any handler that constructs one.

Unlike the previous prototype, the content runtime connection **does not query `AuthSession`**, does not accept the raw refresh token as an access bearer, and does not require read access to identity/MFA secrets.

## Database transaction contract

1. The real AuthGuard independently verifies a short-lived access credential and current session state, including MFA.
2. The boundary validates the principal shape and freshness, but **does not itself authenticate**.
3. It opens a restricted Prisma interactive transaction and sets `app.user_id` and `app.tenant_id` using `set_config(..., true)`.
4. It checks active tenant membership in that same transaction.
5. Only the verified, scoped transaction is passed to `fn`; never leak or retain the transaction after commit.
6. PostgreSQL RLS enforces container-level ACLs, family membership, item and media filtering.

`ContainerAccessService` remains unexposed and requires additional audit, concurrent grant changes and revocation protections before release.

**Mandatory acceptance tests:** an authenticated tenant owner cannot see another member's private container; a removed member cannot see historical ACL grants; a fake `VerifiedPrincipal` passed through HTTP must never be accepted; a revoked or MFA-pending session cannot get inventory access.

The RLS runtime role must never own protected tables, have BYPASSRLS, or read `AuthSession`, `TotpFactor`, password hashes, or recovery code hashes.
