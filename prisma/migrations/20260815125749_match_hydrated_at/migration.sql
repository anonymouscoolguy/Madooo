-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "hydratedAt" TIMESTAMP(3);

-- Everything that already has squad rows was hydrated by hand before this
-- column existed, so without this the first scheduled run would re-read all of
-- it. `now()` is the stamp rather than a guess at the original instant: what
-- the selection asks of this column is whether the reading was taken at least
-- six hours after kickoff, and every one of these was played long enough ago
-- that any present-day stamp answers yes.
--
-- A match played within the last six hours is the deliberate exception. It gets
-- one confirming re-read on the next run, which is what the settle rule is for.
UPDATE "Match" SET "hydratedAt" = now()
WHERE EXISTS (
  SELECT 1 FROM "MatchSquad" WHERE "MatchSquad"."matchId" = "Match"."id"
);
