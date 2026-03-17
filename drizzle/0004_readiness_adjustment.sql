ALTER TABLE "interpreted_insights" ADD COLUMN "readiness_adjustment" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "interpreted_insights" ADD COLUMN "readiness_rationale" text;
