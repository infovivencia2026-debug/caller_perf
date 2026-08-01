-- Phone becomes the only required customer field. Name keeps its existing values but
-- is no longer mandatory: new customers may be created with just a phone number.
ALTER TABLE "Customer" ALTER COLUMN "name" SET DEFAULT '';
UPDATE "Customer" SET "name" = '' WHERE "name" IS NULL;
ALTER TABLE "Customer" ALTER COLUMN "name" SET NOT NULL;
