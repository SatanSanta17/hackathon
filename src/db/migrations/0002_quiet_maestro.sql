CREATE TYPE "public"."hackathon_status" AS ENUM('draft', 'published', 'active', 'judging', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."phase_status" AS ENUM('upcoming', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."phase_type" AS ENUM('registration', 'submission', 'screening', 'judging', 'results');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('idea_sprint', 'build_and_ship', 'innovation_pipeline', 'open_challenge');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'org_only', 'invite_only');--> statement-breakpoint
CREATE TABLE "hackathons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"cover_image_key" text,
	"status" "hackathon_status" DEFAULT 'draft' NOT NULL,
	"template_type" "template_type" NOT NULL,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"team_min_size" integer DEFAULT 1 NOT NULL,
	"team_max_size" integer DEFAULT 5 NOT NULL,
	"allow_individual" boolean DEFAULT true NOT NULL,
	"rules_html" text,
	"faqs_html" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "hackathons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hackathon_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "phase_type" NOT NULL,
	"order" integer NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"config" jsonb,
	"status" "phase_status" DEFAULT 'upcoming' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hackathon_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"resources_url" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hackathon_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rank" integer NOT NULL,
	"image_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hackathon_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"template_type" "template_type" NOT NULL,
	"default_phases" jsonb NOT NULL,
	"icon" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hackathon_templates_slug_unique" UNIQUE("slug"),
	CONSTRAINT "hackathon_templates_template_type_unique" UNIQUE("template_type")
);
--> statement-breakpoint
ALTER TABLE "hackathons" ADD CONSTRAINT "hackathons_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hackathons" ADD CONSTRAINT "hackathons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_hackathon_id_hackathons_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "public"."hackathons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_hackathon_id_hackathons_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "public"."hackathons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prizes" ADD CONSTRAINT "prizes_hackathon_id_hackathons_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "public"."hackathons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hackathons_org_id_idx" ON "hackathons" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "hackathons_slug_idx" ON "hackathons" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "hackathons_status_idx" ON "hackathons" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hackathons_created_by_idx" ON "hackathons" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "phases_hackathon_id_idx" ON "phases" USING btree ("hackathon_id");--> statement-breakpoint
CREATE INDEX "tracks_hackathon_id_idx" ON "tracks" USING btree ("hackathon_id");--> statement-breakpoint
CREATE INDEX "prizes_hackathon_id_idx" ON "prizes" USING btree ("hackathon_id");