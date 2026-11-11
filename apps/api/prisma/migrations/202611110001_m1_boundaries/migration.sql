-- BoxVault M1 security boundary migration.
-- Apply with the migration/owner role, NEVER the app runtime role.
-- Requires an existing Prisma baseline migration and populated tables.
-- For existing production data: perform a reviewed backfill of owner_user_id before
-- enforcing NOT NULL; do NOT guess ownership. New scaffold has no persisted customer data.

CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'REMOVED');
CREATE TYPE "ContainerShareMode" AS ENUM ('PRIVATE', 'SELECTED_MEMBERS', 'ALL_FAMILY');
CREATE TYPE "ContainerGrantPermission" AS ENUM ('VIEW', 'EDIT');
ALTER TABLE "TenantMember" ADD COLUMN "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Container" ADD COLUMN "ownerUserId" UUID;
ALTER TABLE "Container" ADD COLUMN "shareMode" "ContainerShareMode" NOT NULL DEFAULT 'PRIVATE';
-- Guard: abort instead of silently assigning legacy ownership.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Container" WHERE "ownerUserId" IS NULL) THEN
    RAISE EXCEPTION 'Backfill Container.ownerUserId with verified ownership before applying M1';
  END IF;
END $$;
ALTER TABLE "Container" ALTER COLUMN "ownerUserId" SET NOT NULL;
CREATE INDEX "Container_tenantId_ownerUserId_idx" ON "Container"("tenantId","ownerUserId");
CREATE TABLE "ContainerAccessGrant" (
  "id" UUID NOT NULL PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "containerId" UUID NOT NULL,
  "granteeUserId" UUID NOT NULL,
  "permission" "ContainerGrantPermission" NOT NULL,
  "grantedBy" UUID NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ContainerAccessGrant_containerId_tenantId_fkey"
    FOREIGN KEY ("containerId","tenantId") REFERENCES "Container"("id","tenantId") ON DELETE CASCADE,
  CONSTRAINT "ContainerAccessGrant_containerId_granteeUserId_key" UNIQUE ("containerId","granteeUserId")
);
CREATE INDEX "ContainerAccessGrant_tenantId_granteeUserId_revokedAt_idx"
  ON "ContainerAccessGrant"("tenantId","granteeUserId","revokedAt");
CREATE INDEX "ContainerAccessGrant_containerId_revokedAt_idx"
  ON "ContainerAccessGrant"("containerId","revokedAt");
ALTER TABLE "Container" ADD CONSTRAINT "Container_owner_user_membership_fkey"
 FOREIGN KEY ("tenantId","ownerUserId") REFERENCES "TenantMember"("tenantId","userId");
ALTER TABLE "ContainerAccessGrant" ADD CONSTRAINT "ContainerAccessGrant_grantee_membership_fkey"
 FOREIGN KEY ("tenantId","granteeUserId") REFERENCES "TenantMember"("tenantId","userId");
ALTER TABLE "ContainerAccessGrant" ADD CONSTRAINT "ContainerAccessGrant_grantor_membership_fkey"
 FOREIGN KEY ("tenantId","grantedBy") REFERENCES "TenantMember"("tenantId","userId");

-- Trust boundary: only authenticated backend can set these transaction-local claims.
-- Runtime DB role must not have CREATE in public, BYPASSRLS, superuser, or table ownership.
CREATE SCHEMA IF NOT EXISTS security;
REVOKE ALL ON SCHEMA security FROM PUBLIC;
-- Security-definer helpers require a vetted dedicated no-login policy role.\n-- The migration owner must not be the runtime database role.\n-- Review function ownership and RLS recursion before applying.
CREATE OR REPLACE FUNCTION security.actor_id() RETURNS uuid
LANGUAGE sql STABLE SET search_path = pg_catalog AS $$
 SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION security.tenant_id() RETURNS uuid
LANGUAGE sql STABLE SET search_path = pg_catalog AS $$
 SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION security.active_member(t uuid, u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public."TenantMember" m
 WHERE m."tenantId"=t AND m."userId"=u AND m."status"='ACTIVE')
$$;
CREATE OR REPLACE FUNCTION security.member_can_edit(t uuid, u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public."TenantMember" m
 WHERE m."tenantId"=t AND m."userId"=u AND m."status"='ACTIVE'
 AND m."role" IN ('OWNER','EDITOR'))
$$;
CREATE OR REPLACE FUNCTION security.container_allowed(c uuid, t uuid, write_action boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT EXISTS(
   SELECT 1 FROM public."Container" b
   WHERE b.id=c AND b."tenantId"=t
     AND t=security.tenant_id()
     AND security.active_member(t, security.actor_id())
     AND (NOT write_action OR security.member_can_edit(t, security.actor_id()))
     AND (
       b."ownerUserId"=security.actor_id()
       OR b."shareMode"='ALL_FAMILY'
       OR (b."shareMode"='SELECTED_MEMBERS' AND EXISTS(
         SELECT 1 FROM public."ContainerAccessGrant" g
         WHERE g."containerId"=b.id AND g."tenantId"=t
           AND g."granteeUserId"=security.actor_id() AND g."revokedAt" IS NULL
           AND (NOT write_action OR g.permission='EDIT')
       ))
     )
 )
$$;

REVOKE ALL ON FUNCTION security.actor_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION security.active_member(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.member_can_edit(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.container_allowed(uuid,uuid,boolean) FROM PUBLIC;
-- Provisioning step (requires DBA review):
-- GRANT USAGE ON SCHEMA security TO boxvault_runtime;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA security TO boxvault_runtime;

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON "Tenant" FOR SELECT USING
 (id=security.tenant_id() AND security.active_member(id,security.actor_id()));
ALTER TABLE "TenantMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantMember" FORCE ROW LEVEL SECURITY;
CREATE POLICY member_list ON "TenantMember" FOR SELECT USING
 ("tenantId"=security.tenant_id() AND security.active_member("tenantId",security.actor_id()));
ALTER TABLE "Container" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Container" FORCE ROW LEVEL SECURITY;
CREATE POLICY container_select ON "Container" FOR SELECT USING
 (security.container_allowed(id,"tenantId",false));
CREATE POLICY container_insert ON "Container" FOR INSERT WITH CHECK
 ("tenantId"=security.tenant_id() AND "ownerUserId"=security.actor_id()
  AND "shareMode"='PRIVATE' AND security.member_can_edit("tenantId",security.actor_id()));
-- Container sharing/ownership are sensitive. In M1 only the creator can
-- mutate container metadata or delete the container. Edit-granted members can
-- update child items/media but cannot widen sharing or take ownership.
-- Ownership transfer requires a dedicated, audited future service path.
CREATE POLICY container_update ON "Container" FOR UPDATE
 USING ("tenantId"=security.tenant_id()
  AND "ownerUserId"=security.actor_id()
  AND security.member_can_edit("tenantId",security.actor_id()))
 WITH CHECK ("tenantId"=security.tenant_id()
  AND "ownerUserId"=security.actor_id()
  AND security.member_can_edit("tenantId",security.actor_id()));
CREATE POLICY container_delete ON "Container" FOR DELETE USING
 ("tenantId"=security.tenant_id()
  AND "ownerUserId"=security.actor_id()
  AND security.member_can_edit("tenantId",security.actor_id()));
ALTER TABLE "ContainerAccessGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContainerAccessGrant" FORCE ROW LEVEL SECURITY;
CREATE POLICY grant_view ON "ContainerAccessGrant" FOR SELECT USING
 ("tenantId"=security.tenant_id() AND
  (security.actor_id()="granteeUserId" OR EXISTS (
   SELECT 1 FROM public."Container" b WHERE b.id="ContainerAccessGrant"."containerId"
     AND b."tenantId"="ContainerAccessGrant"."tenantId" AND b."ownerUserId"=security.actor_id())));
CREATE POLICY grant_manage_insert ON "ContainerAccessGrant" FOR INSERT WITH CHECK (
 "tenantId"=security.tenant_id() AND
 security.active_member("tenantId","granteeUserId") AND
 "grantedBy"=security.actor_id() AND
 EXISTS (SELECT 1 FROM public."Container" b WHERE b.id="ContainerAccessGrant"."containerId"
 AND b."tenantId"="ContainerAccessGrant"."tenantId" AND b."ownerUserId"=security.actor_id()
 AND b."shareMode"='SELECTED_MEMBERS'));
CREATE POLICY grant_manage_update ON "ContainerAccessGrant" FOR UPDATE
 USING ("tenantId"=security.tenant_id() AND EXISTS (
 SELECT 1 FROM public."Container" b WHERE b.id="ContainerAccessGrant"."containerId" AND b."ownerUserId"=security.actor_id()))
 WITH CHECK ("tenantId"=security.tenant_id() AND EXISTS (
 SELECT 1 FROM public."Container" b WHERE b.id="ContainerAccessGrant"."containerId" AND b."ownerUserId"=security.actor_id()));
CREATE POLICY grant_manage_delete ON "ContainerAccessGrant" FOR DELETE USING
 ("tenantId"=security.tenant_id() AND EXISTS (
 SELECT 1 FROM public."Container" b WHERE b.id="ContainerAccessGrant"."containerId" AND b."ownerUserId"=security.actor_id()));
ALTER TABLE "Item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Item" FORCE ROW LEVEL SECURITY;
CREATE POLICY item_read ON "Item" FOR SELECT USING
 (security.container_allowed("containerId","tenantId",false));
CREATE POLICY item_insert ON "Item" FOR INSERT WITH CHECK
 (security.container_allowed("containerId","tenantId",true));
CREATE POLICY item_update ON "Item" FOR UPDATE
 USING (security.container_allowed("containerId","tenantId",true))
 WITH CHECK (security.container_allowed("containerId","tenantId",true));
CREATE POLICY item_delete ON "Item" FOR DELETE
 USING (security.container_allowed("containerId","tenantId",true));
ALTER TABLE "MediaAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaAsset" FORCE ROW LEVEL SECURITY;
CREATE POLICY media_read ON "MediaAsset" FOR SELECT USING
 (security.container_allowed("containerId","tenantId",false));
CREATE POLICY media_insert ON "MediaAsset" FOR INSERT WITH CHECK
 (security.container_allowed("containerId","tenantId",true));
CREATE POLICY media_update ON "MediaAsset" FOR UPDATE
 USING (security.container_allowed("containerId","tenantId",true))
 WITH CHECK (security.container_allowed("containerId","tenantId",true));
CREATE POLICY media_delete ON "MediaAsset" FOR DELETE USING
 (security.container_allowed("containerId","tenantId",true));

-- Financial/tables are denied to the customer runtime until separately designed
-- finance-specific policies are reviewed. RLS without allow policies = deny.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['Subscription','CreditWallet','CreditEntry','TopupRequest'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
 END LOOP;
END $$;
-- No platform-administrator content access. User/auth/plan tables must have
-- narrowly scoped privileges from separate auth/billing roles, not the content role.
