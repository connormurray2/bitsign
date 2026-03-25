-- AlterTable Document: add isMultisig column
ALTER TABLE "Document" ADD COLUMN "isMultisig" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Signer: add partialSig and partialSigPubkey columns
ALTER TABLE "Signer" ADD COLUMN "partialSig" TEXT;
ALTER TABLE "Signer" ADD COLUMN "partialSigPubkey" TEXT;

-- Drop unique constraint on SigningEvent.txid (multisig shares one txid across all signers)
DROP INDEX "SigningEvent_txid_key";
