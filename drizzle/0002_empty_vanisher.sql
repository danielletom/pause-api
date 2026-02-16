CREATE TABLE "benchmark_aggregates" (
	"id" serial PRIMARY KEY NOT NULL,
	"cohort_key" text NOT NULL,
	"symptom" text NOT NULL,
	"prevalence_pct" real,
	"avg_frequency" real,
	"avg_severity" real,
	"p25_frequency" real,
	"p50_frequency" real,
	"p75_frequency" real,
	"sample_size" integer NOT NULL,
	"computed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "computed_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"readiness" integer,
	"sleep_score" integer,
	"symptom_load" integer,
	"streak" integer DEFAULT 0,
	"recommendation" text,
	"components_json" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"content_type" text NOT NULL,
	"format" text NOT NULL,
	"description" text,
	"ai_description" text,
	"body_markdown" text,
	"audio_url" text,
	"thumbnail_url" text,
	"duration_minutes" integer,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"production_tool" text,
	"status" text DEFAULT 'draft',
	"sort_order" integer DEFAULT 0,
	"program_week" integer,
	"program_day" integer,
	"program_action" text,
	"listens_count" integer DEFAULT 0,
	"reads_count" integer DEFAULT 0,
	"avg_rating" real,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "content_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "content_engagement" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"content_id" integer NOT NULL,
	"action" text NOT NULL,
	"progress_percent" integer DEFAULT 0,
	"duration_seconds" integer,
	"rating" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "narratives" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_correlations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"factor_a" text NOT NULL,
	"factor_b" text NOT NULL,
	"direction" text NOT NULL,
	"confidence" real NOT NULL,
	"effect_size_pct" real NOT NULL,
	"occurrences" integer NOT NULL,
	"total_opportunities" integer NOT NULL,
	"lag_days" integer DEFAULT 0,
	"computed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "log_type" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "custom_symptoms" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "height" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "weight" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "relationship" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "work_status" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "children" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "exercise_frequency" text;