CREATE TABLE "gratitude_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"text" text NOT NULL,
	"theme" text,
	"mood" integer,
	"time" text,
	"source_log_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interpreted_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"raw_insight_json" jsonb NOT NULL,
	"home_narrative" text,
	"weekly_story" text,
	"forecast" text,
	"insight_nudge_title" text,
	"insight_nudge_body" text,
	"readiness_adjustment" integer DEFAULT 0,
	"readiness_rationale" text,
	"correlation_insights_json" jsonb,
	"helps_hurts_json" jsonb,
	"symptom_guidance_json" jsonb,
	"contradictions_json" jsonb,
	"model_used" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"pipeline_version" integer DEFAULT 1,
	"status" text DEFAULT 'complete',
	"computed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text,
	"product" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "program_started_at" timestamp;