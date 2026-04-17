CREATE TYPE "public"."query_fanout_node_kind" AS ENUM('root', 'sub_query', 'source');--> statement-breakpoint
CREATE TABLE "query_fanout_node" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"model_run_id" text NOT NULL,
	"model_run_result_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"prompt_id" text NOT NULL,
	"parent_node_id" text,
	"kind" "query_fanout_node_kind" NOT NULL,
	"sub_query_text" text,
	"source_url" text,
	"normalized_url" text,
	"source_title" text,
	"citation_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "query_fanout_node_dedup_idx" UNIQUE NULLS NOT DISTINCT("model_run_result_id","parent_node_id","kind","sub_query_text","source_url")
);
--> statement-breakpoint
ALTER TABLE "query_fanout_node" ADD CONSTRAINT "query_fanout_node_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_fanout_node" ADD CONSTRAINT "query_fanout_node_model_run_id_model_run_id_fk" FOREIGN KEY ("model_run_id") REFERENCES "public"."model_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_fanout_node" ADD CONSTRAINT "query_fanout_node_model_run_result_id_model_run_result_id_fk" FOREIGN KEY ("model_run_result_id") REFERENCES "public"."model_run_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_fanout_node" ADD CONSTRAINT "query_fanout_node_prompt_id_prompt_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompt"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_fanout_node" ADD CONSTRAINT "query_fanout_node_parent_node_id_query_fanout_node_id_fk" FOREIGN KEY ("parent_node_id") REFERENCES "public"."query_fanout_node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_fanout_node" ADD CONSTRAINT "query_fanout_node_citation_id_citation_id_fk" FOREIGN KEY ("citation_id") REFERENCES "public"."citation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "query_fanout_node_workspace_run_idx" ON "query_fanout_node" USING btree ("workspace_id","model_run_id");--> statement-breakpoint
CREATE INDEX "query_fanout_node_workspace_result_idx" ON "query_fanout_node" USING btree ("workspace_id","model_run_result_id");--> statement-breakpoint
CREATE INDEX "query_fanout_node_workspace_platform_created_idx" ON "query_fanout_node" USING btree ("workspace_id","platform_id","created_at");--> statement-breakpoint
CREATE INDEX "query_fanout_node_parent_idx" ON "query_fanout_node" USING btree ("parent_node_id");