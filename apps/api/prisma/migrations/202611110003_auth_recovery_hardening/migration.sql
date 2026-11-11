-- Security-first identity gate data. Apply after 202611110002_auth_challenges.
CREATE TYPE "EmailActionKind" AS ENUM ('VERIFY_EMAIL','RESET_PASSWORD');
CREATE TYPE "PlatformRole" AS ENUM ('PAYMENT_REVIEWER','OPERATIONS_ADMIN','SECURITY_ADMIN');
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "AuthSession" ADD COLUMN "privilegedStepUpAt" TIMESTAMP(3);
CREATE TABLE "EmailActionToken" (
 "id" UUID NOT NULL,
 "userId" UUID NOT NULL,
 "kind" "EmailActionKind" NOT NULL,
 "tokenHash" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "usedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "EmailActionToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailActionToken_tokenHash_key" ON "EmailActionToken"("tokenHash");
CREATE INDEX "EmailActionToken_userId_kind_usedAt_expiresAt_idx" ON "EmailActionToken"("userId","kind","usedAt","expiresAt");
ALTER TABLE "EmailActionToken" ADD CONSTRAINT "EmailActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "AuthRateLimit" (
 "key" TEXT NOT NULL,
 "count" INTEGER NOT NULL DEFAULT 0,
 "windowEnds" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("key")
);
CREATE TABLE "AuthAuditEvent" (
 "id" UUID NOT NULL,
 "userId" UUID,
 "kind" TEXT NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AuthAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuthAuditEvent_userId_occurredAt_idx" ON "AuthAuditEvent"("userId","occurredAt");
ALTER TABLE "AuthAuditEvent" ADD CONSTRAINT "AuthAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "PlatformOperator" (
 "userId" UUID NOT NULL,
 "role" "PlatformRole" NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PlatformOperator_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "PlatformOperator" ADD CONSTRAINT "PlatformOperator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- All rows are identity/security admin scope; content runtime role receives NO grants.

-- Only the authenticated identity service may call this onboarding primitive.
-- It must validate a verified user and serialize to avoid duplicate tenants.
CREATE OR REPLACE FUNCTION security.bootstrap_personal_tenant(
  p_user uuid, p_tenant uuid, p_membership uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE verified timestamp;
BEGIN
  SELECT "emailVerifiedAt" INTO verified
    FROM public."User" WHERE id = p_user FOR UPDATE;
  IF verified IS NULL THEN
    RAISE EXCEPTION 'Verified account required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public."TenantMember" WHERE "userId" = p_user) THEN
    RETURN;
  END IF;
  INSERT INTO public."Tenant" (id, name) VALUES (p_tenant, 'Personal Vault');
  INSERT INTO public."TenantMember" (id, "tenantId", "userId", role, status)
    VALUES (p_membership, p_tenant, p_user, 'OWNER', 'ACTIVE');
END;
$$;
REVOKE ALL ON FUNCTION security.bootstrap_personal_tenant(uuid,uuid,uuid) FROM PUBLIC;
-- Deployment operator grants only to dedicated auth role.
-- GRANT USAGE ON SCHEMA security TO boxvault_auth_m1;
-- GRANT EXECUTE ON FUNCTION security.bootstrap_personal_tenant(uuid,uuid,uuid) TO boxvault_auth_m1;
