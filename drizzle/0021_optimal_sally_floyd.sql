CREATE TABLE "report_template" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"created_by" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"layout" jsonb NOT NULL,
	"branding" jsonb NOT NULL,
	"cover_overrides" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_template" ADD CONSTRAINT "report_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_template_workspace_id_idx" ON "report_template" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_template_ws_name_idx" ON "report_template" USING btree ("workspace_id","name") WHERE "report_template"."deleted_at" IS NULL;