-- M1: Bind personal tenant bootstrap to a single-use verified-email token.
-- Security boundary: NO caller-supplied user UUID; token row determines identity.
-- Run only after 003 creates EmailActionToken. Migration owner must be privileged.
-- Do not grant EXECUTE to PUBLIC or the inventory runtime.
DROP FUNCTION IF EXISTS security.bootstrap_personal_tenant(uuid,uuid,uuid);

CREATE FUNCTION security.bootstrap_verified_email_tenant(
  p_token_hash text, p_tenant uuid, p_membership uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog AS $$
DECLARE
  token_user uuid;
  verified_at timestamp;
BEGIN
  -- Atomic, exclusive single-use token claim. Other token kinds are rejected.
  -- A failed subsequent step rolls back this claim with the caller transaction.
  UPDATE public."EmailActionToken"
     SET "usedAt" = CURRENT_TIMESTAMP
   WHERE "tokenHash" = p_token_hash
     AND kind = 'VERIFY_EMAIL'::public."EmailActionKind"
     AND "usedAt" IS NULL
     AND "expiresAt" > CURRENT_TIMESTAMP
  RETURNING "userId" INTO token_user;

  IF token_user IS NULL THEN
    RAISE EXCEPTION 'Invalid verification proof' USING ERRCODE = '42501';
  END IF;

  -- Serialize tokens issued to the same account; do not reverify or recreate
  -- a tenant for an already verified or already enrolled account.
  SELECT "emailVerifiedAt" INTO verified_at
    FROM public."User" WHERE id = token_user FOR UPDATE;
  IF NOT FOUND OR verified_at IS NOT NULL OR
      EXISTS (SELECT 1 FROM public."TenantMember" WHERE "userId" = token_user) THEN
    RAISE EXCEPTION 'Account cannot be provisioned' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public."Tenant" (id, name) VALUES (p_tenant, 'Personal Vault');
  INSERT INTO public."TenantMember" (id, "tenantId", "userId", role, status)
    VALUES (p_membership, p_tenant, token_user,
      'OWNER'::public."MembershipRole", 'ACTIVE'::public."MembershipStatus");
  UPDATE public."User"
     SET "emailVerifiedAt" = CURRENT_TIMESTAMP
   WHERE id = token_user;

  -- Other verification links remain logically invalid because the user's
  -- emailVerifiedAt is now non-NULL. Avoid eagerly updating other token rows:
  -- two simultaneous verifications would otherwise lock different tokens,
  -- then contend on the same user and deadlock on each other's token.
  RETURN token_user;
END;
$$;

REVOKE ALL ON FUNCTION security.bootstrap_verified_email_tenant(text,uuid,uuid) FROM PUBLIC;
-- Separate reviewed deployment grant (not in migration):
-- GRANT USAGE ON SCHEMA security TO boxvault_auth_runtime_m1;
-- GRANT EXECUTE ON FUNCTION security.bootstrap_verified_email_tenant(text,uuid,uuid)
--   TO boxvault_auth_runtime_m1;
