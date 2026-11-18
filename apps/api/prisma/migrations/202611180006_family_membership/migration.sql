-- ID-03. Migration identity only. No grants to PUBLIC or inventory/auth tables.
CREATE TYPE "FamilyInvitationStatus" AS ENUM ('PENDING','ACCEPTED','CANCELED');
CREATE TYPE "FamilyAuditKind" AS ENUM ('INVITATION_CREATED','INVITATION_ACCEPTED','INVITATION_CANCELED','MEMBER_ROLE_CHANGED','MEMBER_REMOVED');
CREATE TABLE "FamilyInvitation" (
 id uuid PRIMARY KEY, "tenantId" uuid NOT NULL, "invitedBy" uuid NOT NULL,
 email varchar(254) NOT NULL, role public."MembershipRole" NOT NULL,
 "tokenHash" text NOT NULL, status public."FamilyInvitationStatus" NOT NULL DEFAULT 'PENDING',
 "expiresAt" timestamptz(6) NOT NULL, "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
 "acceptedAt" timestamptz(6), "canceledAt" timestamptz(6),
 CONSTRAINT "FamilyInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 CONSTRAINT "FamilyInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
 CONSTRAINT family_invitation_role CHECK (role IN ('EDITOR','VIEWER')),
 CONSTRAINT family_invitation_email CHECK (email=lower(btrim(email)) AND length(email)>3),
 CONSTRAINT family_invitation_hash CHECK ("tokenHash" ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX "FamilyInvitation_tokenHash_key" ON "FamilyInvitation"("tokenHash");
CREATE INDEX "FamilyInvitation_tenantId_status_expiresAt_idx" ON "FamilyInvitation"("tenantId",status,"expiresAt");
CREATE TABLE "FamilyAuditEvent" (
 id uuid PRIMARY KEY, "tenantId" uuid NOT NULL, "actorUserId" uuid NOT NULL,
 "targetUserId" uuid, "invitationId" uuid, kind public."FamilyAuditKind" NOT NULL,
 "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT "FamilyAuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "FamilyAuditEvent_tenantId_createdAt_idx" ON "FamilyAuditEvent"("tenantId","createdAt");
ALTER TABLE "FamilyInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FamilyInvitation" FORCE ROW LEVEL SECURITY;
ALTER TABLE "FamilyAuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FamilyAuditEvent" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "FamilyInvitation","FamilyAuditEvent" FROM PUBLIC;
-- No allow policies: direct runtime reads/writes (including audit mutation) deny.

-- These are internal helpers, never granted to runtime identities. The backend
-- installs actor/session context only AFTER AccessGuard verifies the live JWT.
CREATE FUNCTION security.family_actor() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := security.actor_id(); sid uuid;
BEGIN
 sid := nullif(current_setting('app.session_id',true),'')::uuid;
 IF actor IS NULL OR sid IS NULL OR NOT EXISTS (
  SELECT 1 FROM public."AuthSession" s JOIN public."User" u ON u.id=s."userId"
  LEFT JOIN public."TotpFactor" f ON f."userId"=u.id
  WHERE s.id=sid AND u.id=actor AND u."emailVerifiedAt" IS NOT NULL
   AND s."revokedAt" IS NULL AND s."expiresAt">(clock_timestamp() AT TIME ZONE 'UTC')
   AND (f."enabledAt" IS NULL OR s."mfaAuthenticatedAt" IS NOT NULL)
 ) THEN RAISE EXCEPTION 'ID03_UNAUTHENTICATED'; END IF;
 RETURN actor;
END $$;

CREATE FUNCTION security.family_owner(t uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid;
BEGIN
 -- Same per-tenant lock used by inventory transactions; serializes seat changes,
 -- role/removal decisions and container creation/sharing across API instances.
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text,0));
 actor := security.family_actor();
 IF NOT EXISTS(SELECT 1 FROM public."TenantMember" m
  WHERE m."tenantId"=t AND m."userId"=actor AND m.status='ACTIVE' AND m.role='OWNER')
 THEN RAISE EXCEPTION 'ID03_RESOURCE_UNAVAILABLE'; END IF;
 RETURN actor;
END $$;

CREATE FUNCTION security.family_eligible(t uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public."Subscription" s JOIN public."Plan" p ON p.id=s."planId"
 WHERE s."tenantId"=t AND s.status='ACTIVE' AND s."validUntil">(clock_timestamp() AT TIME ZONE 'UTC')
 AND p.code='FAMILY' AND p."maxMembers">=4)
$$;

CREATE FUNCTION security.family_workspaces() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := security.family_actor(); result jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'name',q.name,'role',q.role,
  'familyEligible',security.family_eligible(q.id)) ORDER BY q."createdAt",q.id),'[]'::jsonb)
 INTO result FROM (SELECT t.id,t.name,m.role,t."createdAt" FROM public."Tenant" t
 JOIN public."TenantMember" m ON m."tenantId"=t.id
 WHERE m."userId"=actor AND m.status='ACTIVE' ORDER BY t."createdAt",t.id LIMIT 100) q;
 RETURN result;
END $$;

CREATE FUNCTION security.family_members(t uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 PERFORM security.family_owner(t);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'userId',m."userId",'email',u.email,
  'role',m.role,'status',m.status) ORDER BY m.id),'[]'::jsonb) INTO result
 FROM public."TenantMember" m JOIN public."User" u ON u.id=m."userId"
 WHERE m."tenantId"=t AND m.status='ACTIVE';
 RETURN result;
END $$;

CREATE FUNCTION security.family_invitations(t uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 PERFORM security.family_owner(t);
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'email',q.email,'role',q.role,
  'status',CASE WHEN q.status='PENDING' AND q."expiresAt"<=clock_timestamp() THEN 'EXPIRED' ELSE q.status::text END,
  'expiresAt',q."expiresAt",'createdAt',q."createdAt") ORDER BY q."createdAt" DESC,q.id),'[]'::jsonb)
 INTO result FROM (SELECT * FROM public."FamilyInvitation" WHERE "tenantId"=t
 ORDER BY "createdAt" DESC,id LIMIT 100) q;
 RETURN result;
END $$;

CREATE FUNCTION security.family_invite(t uuid, recipient text, member_role text, proof_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := security.family_owner(t); invite_id uuid := gen_random_uuid(); expires timestamptz;
BEGIN
 IF NOT security.family_eligible(t) THEN RAISE EXCEPTION 'ID03_FAMILY_PLAN_REQUIRED'; END IF;
 IF member_role NOT IN ('EDITOR','VIEWER') OR member_role IS NULL OR
  recipient IS NULL OR length(recipient)>254 OR recipient<>lower(btrim(recipient)) OR
  recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR
  proof_hash IS NULL OR proof_hash !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'ID03_INVALID_INPUT'; END IF;
 IF EXISTS(SELECT 1 FROM public."TenantMember" m JOIN public."User" u ON u.id=m."userId"
  WHERE m."tenantId"=t AND m.status='ACTIVE' AND lower(u.email)=recipient)
 THEN RAISE EXCEPTION 'ID03_MEMBER_ACTIVE'; END IF;
 IF EXISTS(SELECT 1 FROM public."FamilyInvitation" WHERE "tenantId"=t AND email=recipient
  AND status='PENDING' AND "expiresAt">clock_timestamp())
 THEN RAISE EXCEPTION 'ID03_INVITATION_PENDING'; END IF;
 IF (SELECT count(*) FROM public."TenantMember" WHERE "tenantId"=t AND status='ACTIVE') +
    (SELECT count(*) FROM public."FamilyInvitation" WHERE "tenantId"=t AND status='PENDING' AND "expiresAt">clock_timestamp())>=4
 THEN RAISE EXCEPTION 'ID03_SEAT_LIMIT'; END IF;
 expires := clock_timestamp()+interval '7 days';
 INSERT INTO public."FamilyInvitation"(id,"tenantId","invitedBy",email,role,"tokenHash","expiresAt")
 VALUES(invite_id,t,actor,recipient,member_role::public."MembershipRole",proof_hash,expires);
 INSERT INTO public."FamilyAuditEvent"(id,"tenantId","actorUserId","invitationId",kind)
 VALUES(gen_random_uuid(),t,actor,invite_id,'INVITATION_CREATED');
 RETURN jsonb_build_object('id',invite_id,'expiresAt',expires,'status','PENDING');
END $$;

CREATE FUNCTION security.family_cancel(t uuid, invitation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := security.family_owner(t); invite public."FamilyInvitation"%ROWTYPE;
BEGIN
 SELECT * INTO invite FROM public."FamilyInvitation" WHERE id=invitation AND "tenantId"=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ID03_RESOURCE_UNAVAILABLE'; END IF;
 IF invite.status='ACCEPTED' THEN RAISE EXCEPTION 'ID03_INVITATION_USED'; END IF;
 IF invite.status='PENDING' THEN
  UPDATE public."FamilyInvitation" SET status='CANCELED',"canceledAt"=clock_timestamp() WHERE id=invitation;
  INSERT INTO public."FamilyAuditEvent"(id,"tenantId","actorUserId","invitationId",kind)
  VALUES(gen_random_uuid(),t,actor,invitation,'INVITATION_CANCELED');
 END IF;
 RETURN jsonb_build_object('id',invitation,'status','CANCELED');
END $$;

CREATE FUNCTION security.family_accept(proof_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE t uuid; actor uuid; recipient text; invite public."FamilyInvitation"%ROWTYPE; member_id uuid;
BEGIN
 SELECT "tenantId" INTO t FROM public."FamilyInvitation" WHERE "tokenHash"=proof_hash;
 IF t IS NULL THEN RAISE EXCEPTION 'ID03_RESOURCE_UNAVAILABLE'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text,0));
 actor := security.family_actor();
 SELECT email INTO recipient FROM public."User" WHERE id=actor;
 SELECT * INTO invite FROM public."FamilyInvitation" WHERE "tokenHash"=proof_hash FOR UPDATE;
 IF NOT FOUND OR invite.status<>'PENDING' OR invite."expiresAt"<=clock_timestamp() OR
   lower(recipient)<>invite.email OR NOT EXISTS(SELECT 1 FROM public."TenantMember" m
    WHERE m."tenantId"=t AND m."userId"=invite."invitedBy" AND m.status='ACTIVE' AND m.role='OWNER')
 THEN RAISE EXCEPTION 'ID03_RESOURCE_UNAVAILABLE'; END IF;
 IF NOT security.family_eligible(t) THEN RAISE EXCEPTION 'ID03_FAMILY_PLAN_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM public."TenantMember" WHERE "tenantId"=t AND "userId"=actor AND status='ACTIVE')
 THEN RAISE EXCEPTION 'ID03_RESOURCE_UNAVAILABLE'; END IF;
 IF (SELECT count(*) FROM public."TenantMember" WHERE "tenantId"=t AND status='ACTIVE')>=4
 THEN RAISE EXCEPTION 'ID03_SEAT_LIMIT'; END IF;
 -- A returning member never regains historical selected-container grants.
 DELETE FROM public."ContainerAccessGrant" WHERE "tenantId"=t AND "granteeUserId"=actor;
 INSERT INTO public."TenantMember"(id,"tenantId","userId",role,status)
 VALUES(gen_random_uuid(),t,actor,invite.role,'ACTIVE')
 ON CONFLICT ("tenantId","userId") DO UPDATE SET role=EXCLUDED.role,status='ACTIVE'
 RETURNING id INTO member_id;
 UPDATE public."FamilyInvitation" SET status='ACCEPTED',"acceptedAt"=clock_timestamp() WHERE id=invite.id;
 INSERT INTO public."FamilyAuditEvent"(id,"tenantId","actorUserId","targetUserId","invitationId",kind)
 VALUES(gen_random_uuid(),t,actor,actor,invite.id,'INVITATION_ACCEPTED');
 RETURN jsonb_build_object('tenantId',t,'membershipId',member_id,'role',invite.role);
END $$;

CREATE FUNCTION security.family_change_role(t uuid, member uuid, member_role text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := security.family_owner(t); target public."TenantMember"%ROWTYPE;
BEGIN
 IF member_role IS NULL OR member_role NOT IN ('EDITOR','VIEWER') THEN RAISE EXCEPTION 'ID03_INVALID_INPUT'; END IF;
 SELECT * INTO target FROM public."TenantMember" WHERE id=member AND "tenantId"=t AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ID03_RESOURCE_UNAVAILABLE'; END IF;
 IF target.role='OWNER' OR target."userId"=actor THEN RAISE EXCEPTION 'ID03_OWNER_IMMUTABLE'; END IF;
 IF target.role::text<>member_role THEN
  UPDATE public."TenantMember" SET role=member_role::public."MembershipRole" WHERE id=member;
  UPDATE public."AuthSession" SET "revokedAt"=clock_timestamp() WHERE "userId"=target."userId" AND "revokedAt" IS NULL;
  INSERT INTO public."FamilyAuditEvent"(id,"tenantId","actorUserId","targetUserId",kind)
  VALUES(gen_random_uuid(),t,actor,target."userId",'MEMBER_ROLE_CHANGED');
 END IF;
 RETURN jsonb_build_object('id',member,'role',member_role);
END $$;

CREATE FUNCTION security.family_remove(t uuid, member uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid := security.family_owner(t); target public."TenantMember"%ROWTYPE;
BEGIN
 SELECT * INTO target FROM public."TenantMember" WHERE id=member AND "tenantId"=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ID03_RESOURCE_UNAVAILABLE'; END IF;
 IF target.role='OWNER' OR target."userId"=actor THEN RAISE EXCEPTION 'ID03_OWNER_IMMUTABLE'; END IF;
 IF EXISTS(SELECT 1 FROM public."Container" WHERE "tenantId"=t AND "ownerUserId"=target."userId")
 THEN RAISE EXCEPTION 'ID03_MEMBER_OWNS_CONTAINERS'; END IF;
 IF target.status='ACTIVE' THEN
  UPDATE public."TenantMember" SET status='REMOVED' WHERE id=member;
  DELETE FROM public."ContainerAccessGrant" WHERE "tenantId"=t AND "granteeUserId"=target."userId";
  UPDATE public."AuthSession" SET "revokedAt"=clock_timestamp() WHERE "userId"=target."userId" AND "revokedAt" IS NULL;
  INSERT INTO public."FamilyAuditEvent"(id,"tenantId","actorUserId","targetUserId",kind)
  VALUES(gen_random_uuid(),t,actor,target."userId",'MEMBER_REMOVED');
 END IF;
 RETURN jsonb_build_object('id',member,'status','REMOVED');
END $$;

-- Explicit deployment grants are separate from the migration, as in M1.
-- Only the eight public entrypoints below may be granted to the content runtime.
REVOKE ALL ON FUNCTION security.family_actor(),security.family_owner(uuid),security.family_eligible(uuid),
 security.family_workspaces(),security.family_members(uuid),security.family_invitations(uuid),
 security.family_invite(uuid,text,text,text),security.family_cancel(uuid,uuid),security.family_accept(text),
 security.family_change_role(uuid,uuid,text),security.family_remove(uuid,uuid) FROM PUBLIC;
