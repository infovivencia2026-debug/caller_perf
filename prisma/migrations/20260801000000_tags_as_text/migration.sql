-- Customer.tags moves from a Postgres text[] to a comma-separated TEXT column, so the
-- same application code works regardless of provider. Existing values are preserved by
-- joining the array rather than dropping and recreating the column.
ALTER TABLE "Customer" ALTER COLUMN "tags" DROP DEFAULT;

ALTER TABLE "Customer"
  ALTER COLUMN "tags" TYPE TEXT USING COALESCE(array_to_string("tags", ','), '');

UPDATE "Customer" SET "tags" = '' WHERE "tags" IS NULL;

ALTER TABLE "Customer" ALTER COLUMN "tags" SET DEFAULT '';
ALTER TABLE "Customer" ALTER COLUMN "tags" SET NOT NULL;
