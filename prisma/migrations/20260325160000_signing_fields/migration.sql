-- CreateTable
CREATE TABLE "SigningField" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "assignedSignerKey" TEXT NOT NULL,
    "value" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SigningField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SigningField_documentId_idx" ON "SigningField"("documentId");

-- AddForeignKey
ALTER TABLE "SigningField" ADD CONSTRAINT "SigningField_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
