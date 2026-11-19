-- Fresh AWS database only, after all committed migrations. Restricted roles must
-- already exist with LOGIN, NOSUPERUSER, NOBYPASSRLS, NOINHERIT, NOCREATEROLE.
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['boxvault_runtime_m1','boxvault_auth_runtime_m1'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=name AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit) OR pg_has_role(name,'boxvault_policy_m1','MEMBER') THEN
   RAISE EXCEPTION 'Invalid restricted runtime role';
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I',current_database(),name);
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA security FROM PUBLIC;
GRANT USAGE ON SCHEMA public,security TO boxvault_runtime_m1,boxvault_auth_runtime_m1;
GRANT SELECT ON public."Tenant",public."TenantMember" TO boxvault_runtime_m1;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."Container",public."Item",public."MediaAsset",public."ContainerAccessGrant" TO boxvault_runtime_m1;
GRANT EXECUTE ON FUNCTION security.actor_id(),security.tenant_id(),security.active_member(uuid,uuid),security.member_can_edit(uuid,uuid),security.container_allowed(uuid,uuid,boolean),security.grant_visible(uuid,uuid,uuid) TO boxvault_runtime_m1;
GRANT EXECUTE ON FUNCTION security.family_workspaces(),security.family_members(uuid),security.family_invitations(uuid),security.family_invite(uuid,text,text,text),security.family_cancel(uuid,uuid),security.family_accept(text),security.family_change_role(uuid,uuid,text),security.family_remove(uuid,uuid) TO boxvault_runtime_m1;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."User",public."AuthIdentity",public."AuthSession",public."AuthChallenge",public."TotpFactor",public."MfaRecoveryCode",public."EmailActionToken",public."AuthRateLimit",public."RefreshTokenReuse" TO boxvault_auth_runtime_m1;
GRANT SELECT,INSERT ON public."AuthAuditEvent" TO boxvault_auth_runtime_m1;
GRANT SELECT ON public."PlatformOperator" TO boxvault_auth_runtime_m1;
GRANT EXECUTE ON FUNCTION security.bootstrap_verified_email_tenant(text,uuid,uuid) TO boxvault_auth_runtime_m1;
