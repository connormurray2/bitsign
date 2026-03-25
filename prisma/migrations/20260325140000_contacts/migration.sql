CREATE TABLE "Contact" (
  "id"          TEXT NOT NULL,
  "ownerKey"    TEXT NOT NULL,
  "identityKey" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Contact_ownerKey_identityKey_key" ON "Contact"("ownerKey", "identityKey");
CREATE INDEX "Contact_ownerKey_idx" ON "Contact"("ownerKey");
