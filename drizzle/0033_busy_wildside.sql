CREATE TYPE "public"."onboarding_suggestion_status" AS ENUM('pending', 'fetching', 'suggesting', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "onboarding_suggestion" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"domain" text NOT NULL,
	"status" "onboarding_suggestion_status" DEFAULT 'pending' NOT NULL,
	"error" jsonb,
	"extracted" jsonb,
	"suggested_competitors" jsonb,
	"suggested_prompts" jsonb,
	"engine_used" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_suggestion" ADD CONSTRAINT "onboarding_suggestion_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onboarding_suggestion_lookup_idx" ON "onboarding_suggestion" USING btree ("workspace_id","domain","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "onboarding_suggestion_done_idx" ON "onboarding_suggestion" USING btree ("workspace_id","domain","created_at" DESC NULLS LAST) WHERE "onboarding_suggestion"."status" = 'done';