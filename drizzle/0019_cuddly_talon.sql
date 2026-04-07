CREATE TYPE "public"."report_job_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "report_job" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"created_by" text NOT NULL,
	"status" "report_job_status" DEFAULT 'pending' NOT NULL,
	"scope" jsonb NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"file_path" text,
	"file_size_bytes" integer,
	"page_count" integer,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_job" ADD CONSTRAINT "report_job_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_job_workspace_id_idx" ON "report_job" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "report_job_status_idx" ON "report_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "report_job_expires_at_idx" ON "report_job" USING btree ("expires_at");