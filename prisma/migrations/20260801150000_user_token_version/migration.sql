-- Token version for session invalidation: bumping it on a password change makes every
-- session issued before the change (and therefore the old password's logins) invalid.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
