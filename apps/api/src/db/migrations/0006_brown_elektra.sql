ALTER TABLE "requirements" ADD COLUMN "quote_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD COLUMN "stage_errors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD COLUMN "needs_human" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "section_edits" ADD COLUMN "compliance_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "section_edits" ADD COLUMN "needs_human" boolean DEFAULT false NOT NULL;