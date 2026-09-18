-- One company per user. Adds owner_id to everything that belongs to a company,
-- and turns the global business keys into per-owner ones.
--
-- Reviewed by hand before being applied, because drizzle-kit's generated version
-- could only ever work on an empty database: it emitted `ADD COLUMN owner_id uuid
-- NOT NULL` (which a table with rows rejects) and left the old primary-key drops
-- commented out. What follows backfills first and constrains second.
--
-- Backfill target: the oldest user, which on any existing install is the demo
-- user the seed created. Rows that cannot be attributed to anyone (a database
-- with no users at all) are deleted - they are seed-derived, the corpus is still
-- on disk, and `db:seed` recreates them.

--> statement-breakpoint
-- ---------------------------------------------------------------- tenders ---
ALTER TABLE "tenders" DROP CONSTRAINT IF EXISTS "tenders_reference_unique";--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
UPDATE "tenders" SET "owner_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
DELETE FROM "tenders" WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "tenders" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_owner_reference_unique" UNIQUE("owner_id","reference");--> statement-breakpoint

-- -------------------------------------------------------------- documents ---
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_content_hash_unique";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "original_name" text;--> statement-breakpoint
UPDATE "documents" SET "owner_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
DELETE FROM "documents" WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_hash_unique" UNIQUE("owner_id","content_hash");--> statement-breakpoint
CREATE INDEX "documents_owner_kind_idx" ON "documents" USING btree ("owner_id","kind");--> statement-breakpoint

-- -------------------------------------------------------- company_profile ---
-- owner_id BECOMES the primary key: the schema itself now makes a second profile
-- for the same user impossible. `ice` stays as an ordinary column.
ALTER TABLE "company_profile" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
UPDATE "company_profile" SET "owner_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
DELETE FROM "company_profile" WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "company_profile" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "company_profile" DROP CONSTRAINT IF EXISTS "company_profile_pkey";--> statement-breakpoint
ALTER TABLE "company_profile" ADD CONSTRAINT "company_profile_pkey" PRIMARY KEY("owner_id");--> statement-breakpoint
ALTER TABLE "company_profile" ADD CONSTRAINT "company_profile_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- ----------------------------------------------------- company_references ---
ALTER TABLE "company_references" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
UPDATE "company_references" SET "owner_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
DELETE FROM "company_references" WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "company_references" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "company_references" DROP CONSTRAINT IF EXISTS "company_references_pkey";--> statement-breakpoint
ALTER TABLE "company_references" ADD CONSTRAINT "company_references_owner_id_id_pk" PRIMARY KEY("owner_id","id");--> statement-breakpoint
ALTER TABLE "company_references" ADD CONSTRAINT "company_references_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- ------------------------------------------------------------ team_members ---
ALTER TABLE "team_members" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
UPDATE "team_members" SET "owner_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1) WHERE "owner_id" IS NULL;--> statement-breakpoint
DELETE FROM "team_members" WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "team_members" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "team_members" DROP CONSTRAINT IF EXISTS "team_members_pkey";--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_owner_id_id_pk" PRIMARY KEY("owner_id","id");--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
