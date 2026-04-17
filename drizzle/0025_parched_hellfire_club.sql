CREATE TABLE "traffic_site_key" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "traffic_site_key_keyHash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "ai_visit" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"source" text NOT NULL,
	"platform" text NOT NULL,
	"referrer_host" text,
	"landing_path" text NOT NULL,
	"user_agent_family" text NOT NULL,
	"site_key_id" text,
	"visited_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traffic_daily_aggregate" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"period_start" date NOT NULL,
	"source" text NOT NULL,
	"platform" text NOT NULL,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"unique_pages" integer DEFAULT 0 NOT NULL,
	"top_pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "traffic_site_key" ADD CONSTRAINT "traffic_site_key_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_visit" ADD CONSTRAINT "ai_visit_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_visit" ADD CONSTRAINT "ai_visit_site_key_id_traffic_site_key_id_fk" FOREIGN KEY ("site_key_id") REFERENCES "public"."traffic_site_key"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traffic_daily_aggregate" ADD CONSTRAINT "traffic_daily_aggregate_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "traffic_site_key_workspace_idx" ON "traffic_site_key" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "traffic_site_key_workspace_status_idx" ON "traffic_site_key" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "ai_visit_workspace_visited_idx" ON "ai_visit" USING btree ("workspace_id","visited_at");--> statement-breakpoint
CREATE INDEX "ai_visit_workspace_platform_visited_idx" ON "ai_visit" USING btree ("workspace_id","platform","visited_at");--> statement-breakpoint
CREATE INDEX "ai_visit_workspace_source_visited_idx" ON "ai_visit" USING btree ("workspace_id","source","visited_at");--> statement-breakpoint
CREATE INDEX "ai_visit_site_key_idx" ON "ai_visit" USING btree ("site_key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "traffic_agg_unique_idx" ON "traffic_daily_aggregate" USING btree ("workspace_id","period_start","source","platform");--> statement-breakpoint
CREATE INDEX "traffic_agg_workspace_period_idx" ON "traffic_daily_aggregate" USING btree ("workspace_id","period_start");