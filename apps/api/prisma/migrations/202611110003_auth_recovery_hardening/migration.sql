-- Security-first identity gate data. Apply after 202611110002_auth_challenges.
CREATE TYPE "EmailActionKind" AS ENUM ('VERIFY_EMAIL','RESET_PASSWORD');
CREATE TYPE "PlatformRole" AS ENUM ('PAYMENT_REVIEWER','OPERATIONS_ADMIN','SECURITY_ADMIN');
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
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
