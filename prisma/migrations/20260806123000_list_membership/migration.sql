-- A file's identity is exactly the rows it contained.
--
-- Phone is unique app-wide, so a number arriving in a second file is not imported
-- again — but it was in that file. Without a membership row the list under-reports
-- itself, and "assign 50 from this file" silently skips leads that were in it.

CREATE TABLE "ListMembership" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "isOrigin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListMembership_listId_customerId_key" ON "ListMembership"("listId", "customerId");
CREATE INDEX "ListMembership_customerId_idx" ON "ListMembership"("customerId");

-- Cascade is right here and only here: a membership is a link, not data. Removing a
-- list or a lead removes the link between them and nothing else.
ALTER TABLE "ListMembership" ADD CONSTRAINT "ListMembership_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "ImportList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListMembership" ADD CONSTRAINT "ListMembership_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from the origin links already recorded, so existing lists keep their
-- contents.
INSERT INTO "ListMembership" ("id", "listId", "customerId", "isOrigin", "createdAt")
SELECT
  'lm_' || substr(md5(c."id" || ':' || c."listId"), 1, 22),
  c."listId",
  c."id",
  true,
  now()
FROM "Customer" c
WHERE c."listId" IS NOT NULL
ON CONFLICT DO NOTHING;
