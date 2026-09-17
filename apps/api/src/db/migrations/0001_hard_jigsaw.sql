CREATE TABLE "tenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"title" text,
	"buyer" text,
	"deadline" timestamp with time zone,
	"estimated_value" numeric,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenders_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"page" integer NOT NULL,
	"article" text,
	"content" text NOT NULL,
	"extraction" text DEFAULT 'text_layer' NOT NULL,
	"embedding" vector(512)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tender_id" uuid,
	"kind" text NOT NULL,
	"file_path" text NOT NULL,
	"content_hash" text NOT NULL,
	"extraction_path" text NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tender_id" uuid NOT NULL,
	"text" text NOT NULL,
	"category" text NOT NULL,
	"obligation" text NOT NULL,
	"quote" text,
	"source_document_id" uuid,
	"source_page" integer NOT NULL,
	"source_article" text
);
--> statement-breakpoint
CREATE TABLE "rubric_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tender_id" uuid NOT NULL,
	"label" text NOT NULL,
	"max_points" numeric NOT NULL,
	"weight" numeric NOT NULL,
	"elimination_threshold" numeric
);
--> statement-breakpoint
CREATE TABLE "analysis_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"verdict" text NOT NULL,
	"confidence" real NOT NULL,
	"justification" text NOT NULL,
	"score" numeric,
	"blockers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"matches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rubric_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unread_pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_results_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tender_id" uuid NOT NULL,
	"graph_version" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"node_trace" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "section_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"section_key" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"edited_by_human" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profile" (
	"ice" text PRIMARY KEY NOT NULL,
	"raison_sociale" text NOT NULL,
	"forme_juridique" text NOT NULL,
	"rc" text NOT NULL,
	"if_fiscal" text NOT NULL,
	"cnss" text NOT NULL,
	"siege" text NOT NULL,
	"creation" integer NOT NULL,
	"effectif" integer NOT NULL,
	"chiffre_affaires" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attestations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secteurs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_references" (
	"id" text PRIMARY KEY NOT NULL,
	"client" text NOT NULL,
	"secteur" text NOT NULL,
	"objet" text NOT NULL,
	"montant_ht_mad" numeric NOT NULL,
	"annee_debut" integer NOT NULL,
	"duree_mois" integer NOT NULL,
	"attestation_bonne_execution" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"initiales" text NOT NULL,
	"poste" text NOT NULL,
	"annees_experience" integer NOT NULL,
	"diplome" text NOT NULL,
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"langues" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"run_id" uuid,
	"tender_id" uuid,
	"tier" text NOT NULL,
	"model" text NOT NULL,
	"operation" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_edits" ADD CONSTRAINT "section_edits_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_chunks_document_page_idx" ON "document_chunks" USING btree ("document_id","page");--> statement-breakpoint
CREATE INDEX "document_chunks_embedding_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "requirements_tender_idx" ON "requirements" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "rubric_criteria_tender_idx" ON "rubric_criteria" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "analysis_runs_tender_idx" ON "analysis_runs" USING btree ("tender_id","started_at");--> statement-breakpoint
CREATE INDEX "section_edits_run_idx" ON "section_edits" USING btree ("run_id","section_key");--> statement-breakpoint
CREATE INDEX "llm_usage_request_idx" ON "llm_usage" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "llm_usage_created_idx" ON "llm_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "llm_usage_run_idx" ON "llm_usage" USING btree ("run_id");