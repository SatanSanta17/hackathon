CREATE TYPE "public"."join_request_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."team_admin_status" AS ENUM('pending_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('lead', 'member');--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hackathon_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"form_data" jsonb,
	"is_discoverable" boolean DEFAULT true NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "registrations_hackathon_user_unique" UNIQUE("hackathon_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "registration_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hackathon_id" uuid NOT NULL,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"options" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hackathon_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"invite_code" text NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"track_id" uuid,
	"admin_status" "team_admin_status" DEFAULT 'approved' NOT NULL,
	"review_reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "teams_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_user_unique" UNIQUE("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "team_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"entry_point" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team_up_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hackathon_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"proposed_team_name" text NOT NULL,
	"message" text,
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hackathons" ADD COLUMN "requires_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_hackathon_id_hackathons_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "public"."hackathons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_fields" ADD CONSTRAINT "registration_fields_hackathon_id_hackathons_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "public"."hackathons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_hackathon_id_hackathons_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "public"."hackathons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_join_requests" ADD CONSTRAINT "team_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_up_requests" ADD CONSTRAINT "team_up_requests_hackathon_id_hackathons_id_fk" FOREIGN KEY ("hackathon_id") REFERENCES "public"."hackathons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_up_requests" ADD CONSTRAINT "team_up_requests_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_up_requests" ADD CONSTRAINT "team_up_requests_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registrations_hackathon_id_idx" ON "registrations" USING btree ("hackathon_id");--> statement-breakpoint
CREATE INDEX "registrations_user_id_idx" ON "registrations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "registration_fields_hackathon_id_idx" ON "registration_fields" USING btree ("hackathon_id");--> statement-breakpoint
CREATE INDEX "teams_hackathon_id_idx" ON "teams" USING btree ("hackathon_id");--> statement-breakpoint
CREATE INDEX "teams_track_id_idx" ON "teams" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "teams_invite_code_idx" ON "teams" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "teams_admin_status_idx" ON "teams" USING btree ("admin_status");--> statement-breakpoint
CREATE INDEX "teams_is_open_idx" ON "teams" USING btree ("is_open");--> statement-breakpoint
CREATE INDEX "team_members_team_id_idx" ON "team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_members_user_id_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_join_requests_team_id_idx" ON "team_join_requests" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_join_requests_user_id_idx" ON "team_join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_join_requests_status_idx" ON "team_join_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "team_invites_team_id_idx" ON "team_invites" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_invites_email_idx" ON "team_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "team_invites_token_idx" ON "team_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "team_up_requests_hackathon_id_idx" ON "team_up_requests" USING btree ("hackathon_id");--> statement-breakpoint
CREATE INDEX "team_up_requests_from_user_id_idx" ON "team_up_requests" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "team_up_requests_to_user_id_idx" ON "team_up_requests" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "team_up_requests_status_idx" ON "team_up_requests" USING btree ("status");