CREATE TYPE "public"."model_run_result_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."model_run_status" AS ENUM('pending', 'running', 'completed', 'partial', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "model_run" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"prompt_set_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"adapter_config_ids" text[] NOT NULL,
	"locale" text,
	"market" text,
	"status" "model_run_status" DEFAULT 'pending' NOT NULL,
	"total_results" integer NOT NULL,
	"pending_results" integer NOT NULL,
	"error_summary" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_run_result" (
	"id" text PRIMARY KEY NOT NULL,
	"model_run_id" text NOT NULL,
	"prompt_id" text NOT NULL,
	"adapter_config_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"interpolated_prompt" text NOT NULL,
	"status" "model_run_result_status" DEFAULT 'pending' NOT NULL,
	"raw_response" jsonb,
	"text_content" text,
	"response_metadata" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "model_run" ADD CONSTRAINT "model_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run" ADD CONSTRAINT "model_run_prompt_set_id_prompt_set_id_fk" FOREIGN KEY ("prompt_set_id") REFERENCES "public"."prompt_set"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run" ADD CONSTRAINT "model_run_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run_result" ADD CONSTRAINT "model_run_result_model_run_id_model_run_id_fk" FOREIGN KEY ("model_run_id") REFERENCES "public"."model_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run_result" ADD CONSTRAINT "model_run_result_prompt_id_prompt_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run_result" ADD CONSTRAINT "model_run_result_adapter_config_id_platform_adapter_id_fk" FOREIGN KEY ("adapter_config_id") REFERENCES "public"."platform_adapter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_run_workspace_id_idx" ON "model_run" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "model_run_workspace_status_idx" ON "model_run" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "model_run_workspace_created_at_idx" ON "model_run" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "model_run_prompt_set_id_idx" ON "model_run" USING btree ("prompt_set_id");--> statement-breakpoint
CREATE INDEX "model_run_brand_id_idx" ON "model_run" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "model_run_result_run_id_idx" ON "model_run_result" USING btree ("model_run_id");--> statement-breakpoint
CREATE INDEX "model_run_result_run_status_idx" ON "model_run_result" USING btree ("model_run_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "model_run_result_unique_idx" ON "model_run_result" USING btree ("model_run_id","prompt_id","adapter_config_id");