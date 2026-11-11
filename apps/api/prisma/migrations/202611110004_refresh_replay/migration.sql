-- Store only keyed refresh-token hashes, never plaintext credentials.
CREATE TABLE "RefreshTokenReuse" (
 "tokenHash" TEXT NOT NULL,
 "userId" UUID NOT NULL,
 "sessionId" UUID NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "RefreshTokenReuse_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "RefreshTokenReuse_userId_expiresAt_idx"
  ON "RefreshTokenReuse"("userId","expiresAt");
ALTER TABLE "RefreshTokenReuse" ADD CONSTRAINT "RefreshTokenReuse_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
