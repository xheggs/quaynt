CREATE TABLE "opportunity" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"prompt_set_id" text NOT NULL,
	"prompt_id" text NOT NULL,
	"period_start" date NOT NULL,
	"type" text NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"competitor_count" integer NOT NULL,
	"total_tracked_brands" integer NOT NULL,
	"platform_count" integer NOT NULL,
	"brand_citation_count" integer NOT NULL,
	"competitors" jsonb NOT NULL,
	"platform_breakdown" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_prompt_set_id_prompt_set_id_fk" FOREIGN KEY ("prompt_set_id") REFERENCES "public"."prompt_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_prompt_id_prompt_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_unique_idx" ON "opportunity" USING btree ("workspace_id","prompt_set_id","brand_id","prompt_id","period_start");--> statement-breakpoint
CREATE INDEX "opportunity_workspace_brand_promptset_period_idx" ON "opportunity" USING btree ("workspace_id","brand_id","prompt_set_id","period_start");--> statement-breakpoint
CREATE INDEX "opportunity_workspace_promptset_period_idx" ON "opportunity" USING btree ("workspace_id","prompt_set_id","period_start");