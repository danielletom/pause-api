CREATE TABLE "bleeding_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"type" text NOT NULL,
	"event_date" date NOT NULL,
	"logged_at" timestamp DEFAULT now(),
	"flow_intensity" text,
	"has_clotting" boolean,
	"clot_size" text,
	"pain_level" text,
	"symptoms" jsonb DEFAULT '[]'::jsonb,
	"mood" text,
	"source_category" text NOT NULL,
	"converted_from_spotting" boolean DEFAULT false,
	"gp_flag" boolean DEFAULT false,
	"notes" text,
	"cycle_id" integer
);
--> statement-breakpoint
CREATE TABLE "content_pipeline" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_id" integer NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"tool" text,
	"output_path" text,
	"error_message" text,
	"metadata" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cycle_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"computed_at" timestamp DEFAULT now(),
	"avg_cycle_length" real,
	"avg_period_length" real,
	"cycle_variance" integer,
	"cycle_range_min" integer,
	"cycle_range_max" integer,
	"cycle_range_label" text,
	"stage" text,
	"stage_confidence" real,
	"variability_trend" text,
	"flow_trend" text,
	"longest_gap_days" integer,
	"predicted_next_start" date,
	"prediction_window_days" integer,
	"prediction_confidence" text,
	"spots_before_period_pct" real,
	"avg_spotting_lead_days" real,
	CONSTRAINT "cycle_analytics_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"period_length" integer,
	"cycle_length" integer,
	"peak_flow" text,
	"avg_pain" real,
	"total_symptoms" integer DEFAULT 0,
	"dominant_mood" text,
	"spotting_events" integer DEFAULT 0,
	"spotting_days_before_start" integer,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "content" ADD COLUMN "program_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "period_tracking_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "period_enabled_at" timestamp;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "period_home_widget" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "period_predictions" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "period_reminders" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "period_cross_insights" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "period_prompt_dismissed_at" timestamp;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "menopause_declared_at" timestamp;