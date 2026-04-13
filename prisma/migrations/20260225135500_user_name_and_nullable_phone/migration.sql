-- Add required display name for users
ALTER TABLE "User" ADD COLUMN "name" TEXT;

-- Backfill existing rows before making column required
UPDATE "User"
SET "name" = COALESCE(NULLIF("phoneNumber", ''), 'User')
WHERE "name" IS NULL;

-- phoneNumber should be optional for name-only participants
ALTER TABLE "User" ALTER COLUMN "phoneNumber" DROP NOT NULL;

-- Enforce required name after backfill
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
