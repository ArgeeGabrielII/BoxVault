# Family Container Sharing and Access Control

**Status:** Approved product requirement; implementation pending. **Security classification:** P0 — no inventory access without explicit authorization.

## 1. Sharing policy

A container is **PRIVATE by default**, even inside a family tenant. The owner or a member with explicit **MANAGE_ACCESS** permission can choose one of three modes:

| Mode | Who can see the container? |
|---|---|
| `PRIVATE` | Container creator/owner only (and users explicitly granted access, if mode transitions to SELECTED) |
| `SELECTED_MEMBERS` | Owner plus individually selected **active** family members |
| `ALL_FAMILY` | All active members of **that same family tenant**, including future members, subject to their assigned access role |

An account's global tenant membership **does not automatically authorize reading privately shared containers**. Global roles cap what a member may do; container ACLs decide which resources they can access. No sharing outside the tenant in MVP. Tenant owner should not silently bypass a private container's access unless an explicit, disclosed recovery/ownership policy is approved. Platform admin has no content access under any mode.

### Permissions and effective access

```text
effectivePermission(user,container,action) =
  authenticated(user)
  AND activeTenantMembership(user,container.tenant_id)
  AND tenantRoleAllows(user.role,action)
  AND (container.owner_user_id == user.id
       OR container.share_mode == ALL_FAMILY
       OR (container.share_mode == SELECTED_MEMBERS
           AND activeContainerGrant(container.id,user.id) allows action))
```

For `ALL_FAMILY`, an active Viewer can **read** but cannot edit; an Editor can edit within its tenant-role ceiling. For `SELECTED_MEMBERS`, optional ACL roles `VIEW` and `EDIT` further restrict the effective permission (intersection with tenant role). Only the creator/authorized owner or explicit `MANAGE_ACCESS` delegate changes sharing, no implicit Editor permission to widen sharing. Tenant owner may invite/remove members, but that alone must **not** confer access to private containers.

## 2. Database design (additional to starter Prisma)

- `containers.owner_user_id` (FK user in same tenant), `share_mode` enum `PRIVATE | SELECTED_MEMBERS | ALL_FAMILY`.
- `container_access_grants`: `id`, `tenant_id`, `container_id`, `grantee_user_id`, `permission` (`VIEW|EDIT`), `granted_by`, `created_at`, `revoked_at`.
- Unique active grant per `(container_id,grantee_user_id)`; composite FK constraints enforce same tenant; no grants for inactive memberships.
- For `PRIVATE`, active grants must not confer access; clear/revoke grants on transitions to `PRIVATE` to prevent accidental reactivation later.
- Child `items` and `media_assets` inherit effective container access. Do not allow direct media ID requests to bypass parent ACL.
- Use PostgreSQL RLS with user **and** tenant context for ACL-aware reads/writes. Tenant-only RLS is insufficient for `PRIVATE` or `SELECTED_MEMBERS`. Shared authorization predicates can be implemented as carefully reviewed, security-definer helpers with pinned `search_path`, minimized grants and no uncontrolled role escalation, or equivalent policies; test runtime role and Prisma pooled transactions.

## 3. API contracts (proposed)

```http
GET   /api/v1/containers/{id}/access
PATCH /api/v1/containers/{id}/access
GET   /api/v1/containers/{id}/members
PUT   /api/v1/containers/{id}/members/{memberId}
DELETE /api/v1/containers/{id}/members/{memberId}
```

Example change (creator or explicit `MANAGE_ACCESS` only):

```json
{
  "shareMode": "SELECTED_MEMBERS",
  "grants": [
    { "userId": "member-a-uuid", "permission": "VIEW" },
    { "userId": "member-b-uuid", "permission": "EDIT" }
  ]
}
```

Membership, role ceiling, same-tenant constraints, plan seats, optimistic concurrency/version, audit actor and recipient must be validated **server-side**. Sharing updates and grant revocations must be atomic. Return no existence hints to unauthorized callers.

## 4. User experience

In container details, show a **Sharing** control:
- **Only me** (default).
- **Selected family members** (member picker, VIEW or EDIT per member, preview of access).
- **Everyone in this family** (clear warning that newly invited family members will also see this container).

Display a compact sharing indicator without showing private container details to users who lack permission. Require a confirmation for widening sharing. Show a readable **Who has access** list to authorized managers. Provide **Remove access**, change mode, and optional expiry of access grants (later). The family owner can manage family memberships and subscription independently of the private-container owner policy.

## 5. Security and edge cases

1. Family A cannot share with or query any user in Family B.
2. A valid scanned QR or NFC token **never** bypasses container ACL; the same user gets denied if not individually or family-wide authorized.
3. Search, aggregate counts, image thumbnails, export, background jobs, notification previews and cached iOS data honor effective ACL.
4. If a selected member is removed from the tenant, remove or invalidate their grants and active download capabilities; rotate/revoke refresh sessions. Signed URL TTL remains short and clients purge cached private content on revocation.
5. `ALL_FAMILY` grants access to new members on successful invite acceptance; `SELECTED_MEMBERS` never does.
6. If the container creator leaves, require a documented transfer or archival workflow that cannot silently expose its contents to a broader audience.
7. Mode changes are logged with resource IDs and actor **but no content, descriptions or photos**.
8. Admin API cannot list grants or access protected container contents for troubleshooting.

## 6. Required automated tests

| Scenario | Expected |
|---|---|
| New container, same-family viewer other than owner | Denied (PRIVATE default) |
| Owner shares with Member A, not B | A allowed according to grant; B denied |
| Owner shares ALL_FAMILY | Active family members allowed within role ceiling |
| New member joins under ALL_FAMILY | Allowed after membership activation |
| New member joins under SELECTED_MEMBERS | Denied until explicit grant |
| Family Editor has VIEW grant | Can view, cannot modify |
| Family Viewer has EDIT grant | Cannot edit (tenant role ceiling) |
| Member removed/revoked | Immediately denied in API and RLS, media URL not newly issued |
| Unauthorized valid QR scan | No content or preview leakage |
| Cross-tenant user ID in grant request | Rejected without revealing existence |
| ALL_FAMILY → PRIVATE | Others lose access, existing grants revoked |
| Admin attempts to access private photos | Denied |
| Search/thumbnail/export with unshared container | No result, counts or media |

**This is a specification, not implemented authorization.** Do not release container/media endpoints until ACL-aware server checks, RLS and corresponding tests are passing.
