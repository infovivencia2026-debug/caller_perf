-- Calls survive the deletion of their lead.
--
-- An invalid number is now deleted outright, but the call that discovered it still
-- happened: the counsellor keeps credit and past performance numbers stay put. So the
-- customer link becomes optional with ON DELETE SET NULL, and the phone/name are
-- snapshotted onto the call itself — after a delete that snapshot is the only record
-- of who was rung.

ALTER TABLE "Call" ADD COLUMN "customerPhone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Call" ADD COLUMN "customerName" TEXT;

-- Backfill from the leads that still exist, so history reads the same after this
-- migration as it did before it.
UPDATE "Call" AS c
SET "customerPhone" = cu."phone",
    "customerName"  = NULLIF(cu."name", '')
FROM "Customer" AS cu
WHERE cu."id" = c."customerId";

ALTER TABLE "Call" ALTER COLUMN "customerId" DROP NOT NULL;

ALTER TABLE "Call" DROP CONSTRAINT "Call_customerId_fkey";
ALTER TABLE "Call" ADD CONSTRAINT "Call_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Append-only trail of corrections made to a logged call, so an edited outcome can
-- always be compared with what was originally recorded.
CREATE TABLE "CallEdit" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "editorId" TEXT,
    "fromStatus" "CallStatus" NOT NULL,
    "toStatus" "CallStatus" NOT NULL,
    "fromResponse" TEXT,
    "toResponse" TEXT,
    "fromComments" TEXT,
    "toComments" TEXT,
    "fromCourse" TEXT,
    "toCourse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallEdit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CallEdit_callId_createdAt_idx" ON "CallEdit"("callId", "createdAt");
CREATE INDEX "CallEdit_editorId_createdAt_idx" ON "CallEdit"("editorId", "createdAt");

ALTER TABLE "CallEdit" ADD CONSTRAINT "CallEdit_callId_fkey"
  FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallEdit" ADD CONSTRAINT "CallEdit_editorId_fkey"
  FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
