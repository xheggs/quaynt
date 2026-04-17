CREATE TABLE "gsc_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"property_url" text NOT NULL,
	"access_token_encrypted" jsonb NOT NULL,
	"refresh_token_encrypted" jsonb NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"scope" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" text,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsc_query_performance" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"gsc_connection_id" text NOT NULL,
	"property_url" text NOT NULL,
	"date" date NOT NULL,
	"query" text NOT NULL,
	"page" text NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" numeric(7, 6) DEFAULT '0' NOT NULL,
	"position" numeric(7, 3) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gsc_connection" ADD CONSTRAINT "gsc_connection_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_query_performance" ADD CONSTRAINT "gsc_query_performance_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gsc_query_performance" ADD CONSTRAINT "gsc_query_performance_gsc_connection_id_gsc_connection_id_fk" FOREIGN KEY ("gsc_connection_id") REFERENCES "public"."gsc_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gsc_connection_workspace_property_idx" ON "gsc_connection" USING btree ("workspace_id","property_url");--> statement-breakpoint
CREATE INDEX "gsc_connection_workspace_status_idx" ON "gsc_connection" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "gsc_query_performance_unique_idx" ON "gsc_query_performance" USING btree ("workspace_id","gsc_connection_id","date","query","page");--> statement-breakpoint
CREATE INDEX "gsc_query_performance_workspace_date_idx" ON "gsc_query_performance" USING btree ("workspace_id","date");--> statement-breakpoint
CREATE INDEX "gsc_query_performance_workspace_query_idx" ON "gsc_query_performance" USING btree ("workspace_id","query");