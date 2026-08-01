-- CreateEnum
CREATE TYPE "JudgementTag" AS ENUM ('MVP', 'STANDOUT', 'FLOP');

-- CreateTable
CREATE TABLE "League" (
    "id" SERIAL NOT NULL,
    "apiFootballId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "logo" TEXT,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "apiFootballId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "apiFootballId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "photo" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "apiFootballId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "round" TEXT NOT NULL,
    "kickoff" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "statusElapsed" INTEGER,
    "venueApiFootballId" INTEGER,
    "venueName" TEXT,
    "venueCity" TEXT,
    "referee" TEXT,
    "homeTeamId" INTEGER NOT NULL,
    "awayTeamId" INTEGER NOT NULL,
    "homeGoals" INTEGER,
    "awayGoals" INTEGER,
    "homeHalftimeGoals" INTEGER,
    "awayHalftimeGoals" INTEGER,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchLineup" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "formation" TEXT,
    "coachApiFootballId" INTEGER,
    "coachName" TEXT,
    "kitPlayerPrimary" TEXT,
    "kitPlayerNumber" TEXT,
    "kitPlayerBorder" TEXT,
    "kitGoalkeeperPrimary" TEXT,
    "kitGoalkeeperNumber" TEXT,
    "kitGoalkeeperBorder" TEXT,

    CONSTRAINT "MatchLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSquad" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "shirtNumber" INTEGER,
    "position" TEXT,
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "grid" TEXT,
    "minutes" INTEGER,

    CONSTRAINT "MatchSquad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Judgement" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "matchSquadId" INTEGER NOT NULL,
    "tag" "JudgementTag",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Judgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "League_apiFootballId_key" ON "League"("apiFootballId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_apiFootballId_key" ON "Team"("apiFootballId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_apiFootballId_key" ON "Player"("apiFootballId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_apiFootballId_key" ON "Match"("apiFootballId");

-- CreateIndex
CREATE INDEX "Match_leagueId_season_round_idx" ON "Match"("leagueId", "season", "round");

-- CreateIndex
CREATE INDEX "Match_kickoff_idx" ON "Match"("kickoff");

-- CreateIndex
CREATE UNIQUE INDEX "MatchLineup_matchId_teamId_key" ON "MatchLineup"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "MatchSquad_playerId_idx" ON "MatchSquad"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSquad_matchId_playerId_key" ON "MatchSquad"("matchId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "Judgement_userId_createdAt_idx" ON "Judgement"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Judgement_userId_matchSquadId_key" ON "Judgement"("userId", "matchSquadId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSquad" ADD CONSTRAINT "MatchSquad_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSquad" ADD CONSTRAINT "MatchSquad_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSquad" ADD CONSTRAINT "MatchSquad_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Judgement" ADD CONSTRAINT "Judgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Judgement" ADD CONSTRAINT "Judgement_matchSquadId_fkey" FOREIGN KEY ("matchSquadId") REFERENCES "MatchSquad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Added by hand: Prisma's schema language has no syntax for CHECK constraints.
-- A judgement must say something — either a tag, or a note, or both.
ALTER TABLE "Judgement"
  ADD CONSTRAINT "judgement_has_content"
  CHECK ("tag" IS NOT NULL OR "note" IS NOT NULL);
