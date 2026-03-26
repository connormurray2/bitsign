CREATE TABLE "UserProfile" (
  "id" TEXT NOT NULL,
  "identityKey" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "signatureS3Key" TEXT NOT NULL,
  "signatureHash" TEXT NOT NULL,
  "registrationTxid" TEXT NOT NULL,
  "commitmentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserProfile_identityKey_key" ON "UserProfile"("identityKey");
CREATE INDEX "UserProfile_identityKey_idx" ON "UserProfile"("identityKey");

CREATE TABLE "ProfileRegistration" (
  "id" TEXT NOT NULL,
  "identityKey" TEXT NOT NULL,
  "txid" TEXT NOT NULL,
  "commitmentHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "signatureS3Key" TEXT NOT NULL,
  "signatureHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileRegistration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProfileRegistration_txid_key" ON "ProfileRegistration"("txid");
CREATE INDEX "ProfileRegistration_identityKey_idx" ON "ProfileRegistration"("identityKey");

ALTER TABLE "ProfileRegistration" ADD CONSTRAINT "ProfileRegistration_identityKey_fkey"
  FOREIGN KEY ("identityKey") REFERENCES "UserProfile"("identityKey") ON DELETE RESTRICT ON UPDATE CASCADE;
