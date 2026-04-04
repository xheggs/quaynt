CREATE TYPE "public"."citation_type" AS ENUM('owned', 'earned');--> statement-breakpoint
CREATE TABLE "citation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"model_run_id" text NOT NULL,
	"model_run_result_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"citation_type" "citation_type" NOT NULL,
	"position" integer NOT NULL,
	"context_snippet" text,
	"relevance_signal" text NOT NULL,
	"source_url" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_model_run_id_model_run_id_fk" FOREIGN KEY ("model_run_id") REFERENCES "public"."model_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_model_run_result_id_model_run_result_id_fk" FOREIGN KEY ("model_run_result_id") REFERENCES "public"."model_run_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "citation_workspace_id_idx" ON "citation" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "citation_brand_id_idx" ON "citation" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "citation_model_run_id_idx" ON "citation" USING btree ("model_run_id");--> statement-breakpoint
CREATE INDEX "citation_model_run_result_id_idx" ON "citation" USING btree ("model_run_result_id");--> statement-breakpoint
CREATE INDEX "citation_workspace_brand_platform_idx" ON "citation" USING btree ("workspace_id","brand_id","platform_id");--> statement-breakpoint
CREATE INDEX "citation_workspace_created_at_idx" ON "citation" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "citation_result_url_unique_idx" ON "citation" USING btree ("model_run_result_id","source_url");