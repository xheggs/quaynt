CREATE TABLE "trend_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"prompt_set_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"locale" text NOT NULL,
	"metric" text NOT NULL,
	"period" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"value" numeric(10, 4) NOT NULL,
	"previous_value" numeric(10, 4),
	"delta" numeric(10, 4),
	"change_rate" numeric(8, 4),
	"ewma_value" numeric(10, 4),
	"ewma_upper" numeric(10, 4),
	"ewma_lower" numeric(10, 4),
	"is_anomaly" boolean DEFAULT false NOT NULL,
	"anomaly_direction" text,
	"is_significant" boolean,
	"p_value" numeric(6, 4),
	"confidence_lower" numeric(10, 4),
	"confidence_upper" numeric(10, 4),
	"sample_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trend_snapshot" ADD CONSTRAINT "trend_snapshot_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_snapshot" ADD CONSTRAINT "trend_snapshot_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_snapshot" ADD CONSTRAINT "trend_snapshot_prompt_set_id_prompt_set_id_fk" FOREIGN KEY ("prompt_set_id") REFERENCES "public"."prompt_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trend_snapshot_unique_idx" ON "trend_snapshot" USING btree ("workspace_id","prompt_set_id","brand_id","platform_id","locale","metric","period","period_start");--> statement-breakpoint
CREATE INDEX "trend_snapshot_workspace_brand_idx" ON "trend_snapshot" USING btree ("workspace_id","brand_id","period_start");--> statement-breakpoint
CREATE INDEX "trend_snapshot_anomaly_idx" ON "trend_snapshot" USING btree ("workspace_id","is_anomaly") WHERE "trend_snapshot"."is_anomaly" = true;