CREATE TABLE "seo_score_formula_migration" (
	"formula_version" integer PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_score_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"granularity" text NOT NULL,
	"platform_id" text DEFAULT '_all' NOT NULL,
	"locale" text DEFAULT '_all' NOT NULL,
	"composite" numeric(4, 1),
	"composite_raw" numeric(4, 1),
	"display_cap_applied" boolean DEFAULT false NOT NULL,
	"formula_version" integer NOT NULL,
	"contributing_prompt_set_ids" text[] DEFAULT '{}' NOT NULL,
	"query_set_size" integer DEFAULT 0 NOT NULL,
	"data_quality_advisories" text[] DEFAULT '{}' NOT NULL,
	"code" text,
	"factors" jsonb NOT NULL,
	"inputs" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seo_score_snapshot" ADD CONSTRAINT "seo_score_snapshot_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_score_snapshot" ADD CONSTRAINT "seo_score_snapshot_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seo_score_snapshot_unique_idx" ON "seo_score_snapshot" USING btree ("workspace_id","brand_id","period_start","granularity","platform_id","locale");--> statement-breakpoint
CREATE INDEX "seo_score_snapshot_brand_period_idx" ON "seo_score_snapshot" USING btree ("workspace_id","brand_id","period_start");