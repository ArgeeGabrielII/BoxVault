-- RDS-compatible security-definer ownership. Runtime never receives this role.
-- FORCE RLS remains on; dedicated policies allow only the no-login helper owner.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='boxvault_policy_m1') THEN
  CREATE ROLE boxvault_policy_m1 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='boxvault_policy_m1' AND
    (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Unsafe policy-role attributes';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.member
    WHERE a.roleid='boxvault_policy_m1'::regrole AND
          r.rolname IN ('boxvault_runtime_m1','boxvault_auth_runtime_m1')) THEN
  RAISE EXCEPTION 'Runtime must not inherit the policy role';
 END IF;
END $$;
-- A non-superuser migration owner needs membership to transfer function ownership.
GRANT boxvault_policy_m1 TO CURRENT_USER;
GRANT USAGE ON SCHEMA public,security TO boxvault_policy_m1;
GRANT EXECUTE ON FUNCTION security.actor_id(),security.tenant_id() TO boxvault_policy_m1;
GRANT CREATE ON SCHEMA security TO boxvault_policy_m1;
GRANT SELECT ON public."User",public."AuthSession",public."TotpFactor",public."Plan",
 public."Subscription",public."Tenant",public."TenantMember",public."Container",
 public."ContainerAccessGrant",public."EmailActionToken",public."FamilyInvitation"
 TO boxvault_policy_m1;
GRANT INSERT ON public."Tenant",public."TenantMember",public."FamilyInvitation",public."FamilyAuditEvent" TO boxvault_policy_m1;
GRANT UPDATE("emailVerifiedAt") ON public."User" TO boxvault_policy_m1;
GRANT UPDATE("usedAt") ON public."EmailActionToken" TO boxvault_policy_m1;
GRANT UPDATE("revokedAt") ON public."AuthSession" TO boxvault_policy_m1;
GRANT UPDATE(role,status) ON public."TenantMember" TO boxvault_policy_m1;
GRANT UPDATE(status,"acceptedAt","canceledAt") ON public."FamilyInvitation" TO boxvault_policy_m1;
GRANT DELETE ON public."ContainerAccessGrant" TO boxvault_policy_m1;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['Tenant','TenantMember','Container','ContainerAccessGrant','Subscription','FamilyInvitation','FamilyAuditEvent'] LOOP
  EXECUTE format('CREATE POLICY boxvault_helper_owner ON public.%I TO boxvault_policy_m1 USING (true) WITH CHECK (true)',t);
 END LOOP;
END $$;
ALTER FUNCTION security.active_member(uuid,uuid) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.member_can_edit(uuid,uuid) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.container_allowed(uuid,uuid,boolean) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.grant_visible(uuid,uuid,uuid) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.bootstrap_verified_email_tenant(text,uuid,uuid) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.family_actor() OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.family_owner(uuid) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.family_eligible(uuid) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.family_workspaces() OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.family_members(uuid) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.family_invitations(uuid) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.family_invite(uuid,text,text,text) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.family_cancel(uuid,uuid) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.family_accept(text) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.family_change_role(uuid,uuid,text) OWNER TO boxvault_policy_m1;
ALTER FUNCTION security.family_remove(uuid,uuid) OWNER TO boxvault_policy_m1;
REVOKE CREATE ON SCHEMA security FROM boxvault_policy_m1;
-- Function EXECUTE grants remain the narrowly scoped grants from deployment.
-- Do not grant policy-role membership, schema CREATE or table ownership to runtime.
