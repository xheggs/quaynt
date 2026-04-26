CREATE TYPE "public"."onboarding_step" AS ENUM('welcome', 'brand', 'competitors', 'prompt_set', 'first_run', 'done');--> statement-breakpoint
CREATE TABLE "workspace_onboarding" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"step" "onboarding_step" DEFAULT 'welcome' NOT NULL,
	"role_hint" text,
	"milestones" jsonb DEFAULT '{"brandAdded":false,"competitorsAdded":false,"promptSetSelected":false,"firstRunTriggered":false}'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_onboarding" ADD CONSTRAINT "workspace_onboarding_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_onboarding_ws_idx" ON "workspace_onboarding" USING btree ("workspace_id");