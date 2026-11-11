# M1 security boundary integration contract

This code is **not an authentication implementation**. Do not expose container
endpoints or deploy to production until the issuer of session bearers, MFA gate,
session revocation, anti-enumeration and rate limits are implemented and audited.

`TenantBoundaryService.withAuthorizedTenant(bearer, tenantId, fn)`:

1. Looks up the hashed bearer token in `AuthSession`; rejects expired/revoked.
2. Opens a Prisma interactive transaction.
3. Sets **transaction-local** `app.user_id` and `app.tenant_id`.
4. Checks active tenant membership; passes only a scoped transaction to `fn`.
5. Clears context automatically at commit/rollback. Never return `tx` to caller.

`ContainerAccessService` demonstrates the structure for private creation, RLS-filtered
reads and atomic sharing changes. It is **internal only**, and not wired to controllers.
A full design must add auditing, versioning, association-safe constraints and
grant-revocation behavior before endpoints can be published.

Important: RLS is necessary but not sufficient. PostgreSQL must use a least-
privileged runtime identity and integration tests must verify non-bypass behavior.
All auth/session operations must be performed with dedicated narrow privileges.
