-- Uploaded files become first-class: every import is a list, and every lead it created
-- belongs to it. Assignment can then work a folder at a time instead of drawing from
-- one undifferentiated pool.

CREATE TABLE "ImportList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "rowsImported" INTEGER NOT NULL DEFAULT 0,
    "rowsDuplicate" INTEGER NOT NULL DEFAULT 0,
    "rowsInvalid" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportList_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportList_createdAt_idx" ON "ImportList"("createdAt");

ALTER TABLE "ImportList" ADD CONSTRAINT "ImportList_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SET NULL, not CASCADE: deleting the record of a file must never delete the leads it
-- brought in. This app has already lost call history to a cascade once.
ALTER TABLE "Customer" ADD COLUMN "listId" TEXT;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "ImportList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Customer_listId_assignedToId_idx" ON "Customer"("listId", "assignedToId");
