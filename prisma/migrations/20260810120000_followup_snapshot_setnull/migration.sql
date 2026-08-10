-- Preserve callbacks/follow-ups when their lead is deleted: snapshot the lead and
-- switch the FK from CASCADE to SET NULL (mirrors what Call already does).

-- 1. Snapshot columns.
ALTER TABLE "FollowUp" ADD COLUMN "customerPhone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FollowUp" ADD COLUMN "customerName" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "customerStatus" TEXT;

-- 2. Backfill snapshots from the current customer.
UPDATE "FollowUp" f
SET "customerPhone" = cu."phone",
    "customerName"  = cu."name",
    "customerStatus"= cu."status"::text
FROM "Customer" cu
WHERE cu."id" = f."customerId";

-- 3. Make the link optional and SET NULL on delete.
ALTER TABLE "FollowUp" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "FollowUp" DROP CONSTRAINT "FollowUp_customerId_fkey";
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
