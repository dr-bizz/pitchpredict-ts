CREATE TYPE "public"."role" AS ENUM('player', 'admin');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('group', 'r32', 'r16', 'qf', 'sf', 'third_place', 'final');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('scheduled', 'live', 'finished');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "champion_picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "champion_picks_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fixtures" (
	"id" serial PRIMARY KEY NOT NULL,
	"home_team_id" integer NOT NULL,
	"away_team_id" integer NOT NULL,
	"stadium_id" integer NOT NULL,
	"kickoff_at" timestamp with time zone NOT NULL,
	"stage" "stage" DEFAULT 'group' NOT NULL,
	"status" "status" DEFAULT 'scheduled' NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"fixture_id" integer NOT NULL,
	"home_score" integer NOT NULL,
	"away_score" integer NOT NULL,
	"points_awarded" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stadiums" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"group_name" text NOT NULL,
	"flag_emoji" text NOT NULL,
	CONSTRAINT "teams_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'player' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "champion_picks" ADD CONSTRAINT "champion_picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "champion_picks" ADD CONSTRAINT "champion_picks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_stadium_id_stadiums_id_fk" FOREIGN KEY ("stadium_id") REFERENCES "public"."stadiums"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "predictions" ADD CONSTRAINT "predictions_fixture_id_fixtures_id_fk" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fixtures_kickoff_at_idx" ON "fixtures" USING btree ("kickoff_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "predictions_user_id_fixture_id_unique" ON "predictions" USING btree ("user_id","fixture_id");