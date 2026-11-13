-- Short-lived single-use MFA login challenges; no token or secret stored in plaintext.
CREATE TABLE "AuthChallenge" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuthChallenge_userId_consumedAt_expiresAt_idx" ON "AuthChallenge"("userId","consumedAt","expiresAt");
ALTER TABLE "AuthChallenge" ADD CONSTRAINT "AuthChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
