CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body_markdown" text,
	"category" text,
	"read_time" integer,
	"thumbnail_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "daily_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"symptoms_json" jsonb,
	"mood" integer,
	"energy" integer,
	"sleep_hours" real,
	"sleep_quality" text,
	"disruptions" integer,
	"context_tags" jsonb DEFAULT '[]'::jsonb,
	"cycle_data_json" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "health_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text,
	"date" date,
	"sleep_json" jsonb,
	"heart_rate_json" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "med_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"medication_id" integer NOT NULL,
	"date" date NOT NULL,
	"taken" boolean DEFAULT false,
	"taken_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"dose" text,
	"time" text,
	"frequency" text DEFAULT 'daily',
	"type" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"email" text,
	"date_of_birth" text,
	"stage" text,
	"symptoms" jsonb DEFAULT '[]'::jsonb,
	"goals" jsonb DEFAULT '[]'::jsonb,
	"onboarding_complete" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "program_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"week" integer NOT NULL,
	"lesson_id" text NOT NULL,
	"completed" boolean DEFAULT false,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expo_token" text NOT NULL,
	"platform" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sos_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed" boolean DEFAULT false,
	"duration_seconds" integer,
	"rating" text
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier" text DEFAULT 'free',
	"provider" text,
	"status" text DEFAULT 'active',
	"started_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;