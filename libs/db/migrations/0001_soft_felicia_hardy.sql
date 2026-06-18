ALTER TABLE "fixtures" ALTER COLUMN "home_team_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fixtures" ALTER COLUMN "away_team_id" DROP NOT NULL;--> statement-breakpoint
UPDATE "fixtures" SET "home_team_id" = NULL, "away_team_id" = NULL WHERE "stage" <> 'group';