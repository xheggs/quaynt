CREATE TYPE "public"."query_fanout_node_source" AS ENUM('observed', 'simulated');--> statement-breakpoint
CREATE TABLE "query_fanout_simulation_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_hash" text NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"model_version" text DEFAULT '' NOT NULL,
	"sub_queries" jsonb NOT NULL,
	"sub_query_count" integer NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "query_fanout_node" ALTER COLUMN "model_run_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "query_fanout_node" ALTER COLUMN "model_run_result_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "query_fanout_node" ALTER COLUMN "platform_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "query_fanout_node" ADD COLUMN "source" "query_fanout_node_source" DEFAULT 'observed' NOT NULL;--> statement-breakpoint
ALTER TABLE "query_fanout_node" ADD COLUMN "intent_type" text;--> statement-breakpoint
ALTER TABLE "query_fanout_node" ADD COLUMN "simulation_provider" text;--> statement-breakpoint
ALTER TABLE "query_fanout_node" ADD COLUMN "simulation_model" text;--> statement-breakpoint
CREATE UNIQUE INDEX "query_fanout_simulation_cache_key_idx" ON "query_fanout_simulation_cache" USING btree ("prompt_hash","model_id","model_version");--> statement-breakpoint
CREATE INDEX "query_fanout_simulation_cache_generated_at_idx" ON "query_fanout_simulation_cache" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "query_fanout_simulation_cache_last_hit_at_idx" ON "query_fanout_simulation_cache" USING btree ("last_hit_at");--> statement-breakpoint
CREATE INDEX "query_fanout_node_workspace_prompt_source_idx" ON "query_fanout_node" USING btree ("workspace_id","prompt_id","source");--> statement-breakpoint
CREATE UNIQUE INDEX "query_fanout_node_simulated_dedup_idx" ON "query_fanout_node" USING btree ("workspace_id","prompt_id","parent_node_id","kind","sub_query_text") WHERE "query_fanout_node"."source" = 'simulated';--> statement-breakpoint
ALTER TABLE "query_fanout_node" ADD CONSTRAINT "query_fanout_node_intent_type_check" CHECK ("query_fanout_node"."intent_type" IS NULL OR "query_fanout_node"."intent_type" IN ('related', 'implicit', 'comparative', 'reformulation', 'entity_expansion', 'recent', 'personalised', 'other'));