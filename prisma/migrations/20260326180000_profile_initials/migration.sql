ALTER TABLE "UserProfile" ADD COLUMN "initialsS3Key" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "initialsHash" TEXT;

ALTER TABLE "ProfileRegistration" ADD COLUMN "initialsS3Key" TEXT;
ALTER TABLE "ProfileRegistration" ADD COLUMN "initialsHash" TEXT;
