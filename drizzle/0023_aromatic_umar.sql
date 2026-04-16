CREATE TABLE "crawler_upload" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"filename" text NOT NULL,
	"format" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"content_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"lines_total" integer DEFAULT 0,
	"lines_parsed" integer DEFAULT 0,
	"lines_skipped" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler_visit" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"upload_id" text,
	"bot_name" text NOT NULL,
	"bot_category" text NOT NULL,
	"user_agent" text NOT NULL,
	"request_path" text NOT NULL,
	"request_method" text DEFAULT 'GET' NOT NULL,
	"status_code" integer NOT NULL,
	"response_bytes" integer DEFAULT 0 NOT NULL,
	"visited_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler_daily_aggregate" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"period_start" date NOT NULL,
	"bot_name" text NOT NULL,
	"bot_category" text NOT NULL,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"unique_paths" integer DEFAULT 0 NOT NULL,
	"avg_response_bytes" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"top_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawler_upload" ADD CONSTRAINT "crawler_upload_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_visit" ADD CONSTRAINT "crawler_visit_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_visit" ADD CONSTRAINT "crawler_visit_upload_id_crawler_upload_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."crawler_upload"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_daily_aggregate" ADD CONSTRAINT "crawler_daily_aggregate_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crawler_upload_workspace_id_idx" ON "crawler_upload" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "crawler_upload_workspace_status_idx" ON "crawler_upload" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "crawler_upload_workspace_hash_idx" ON "crawler_upload" USING btree ("workspace_id","content_hash");--> statement-breakpoint
CREATE INDEX "crawler_visit_workspace_visited_idx" ON "crawler_visit" USING btree ("workspace_id","visited_at");--> statement-breakpoint
CREATE INDEX "crawler_visit_workspace_bot_visited_idx" ON "crawler_visit" USING btree ("workspace_id","bot_name","visited_at");--> statement-breakpoint
CREATE INDEX "crawler_visit_workspace_path_visited_idx" ON "crawler_visit" USING btree ("workspace_id","request_path","visited_at");--> statement-breakpoint
CREATE INDEX "crawler_visit_upload_id_idx" ON "crawler_visit" USING btree ("upload_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crawler_agg_unique_idx" ON "crawler_daily_aggregate" USING btree ("workspace_id","period_start","bot_name","bot_category");--> statement-breakpoint
CREATE INDEX "crawler_agg_workspace_period_idx" ON "crawler_daily_aggregate" USING btree ("workspace_id","period_start");