-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('PENDING', 'COMPLETE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SignerStatus" AS ENUM ('PENDING', 'NOTIFIED', 'SIGNED');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "creatorKey" TEXT NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signer" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "handle" TEXT,
    "order" INTEGER NOT NULL,
    "status" "SignerStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningEvent" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "txid" TEXT NOT NULL,
    "outputIndex" INTEGER NOT NULL DEFAULT 0,
    "docHash" TEXT NOT NULL,
    "ecdsaSig" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "rawTx" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_s3Key_key" ON "Document"("s3Key");

-- CreateIndex
CREATE INDEX "Document_creatorKey_idx" ON "Document"("creatorKey");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Signer_token_key" ON "Signer"("token");

-- CreateIndex
CREATE INDEX "Signer_documentId_idx" ON "Signer"("documentId");

-- CreateIndex
CREATE INDEX "Signer_token_idx" ON "Signer"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Signer_documentId_identityKey_key" ON "Signer"("documentId", "identityKey");

-- CreateIndex
CREATE UNIQUE INDEX "SigningEvent_signerId_key" ON "SigningEvent"("signerId");

-- CreateIndex
CREATE UNIQUE INDEX "SigningEvent_txid_key" ON "SigningEvent"("txid");

-- CreateIndex
CREATE INDEX "SigningEvent_documentId_idx" ON "SigningEvent"("documentId");

-- CreateIndex
CREATE INDEX "SigningEvent_identityKey_idx" ON "SigningEvent"("identityKey");

-- CreateIndex
CREATE INDEX "SigningEvent_txid_idx" ON "SigningEvent"("txid");

-- AddForeignKey
ALTER TABLE "Signer" ADD CONSTRAINT "Signer_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningEvent" ADD CONSTRAINT "SigningEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningEvent" ADD CONSTRAINT "SigningEvent_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "Signer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
