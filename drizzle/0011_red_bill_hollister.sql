CREATE TABLE "citation_source_aggregate" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"prompt_set_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"locale" text NOT NULL,
	"domain" text NOT NULL,
	"period_start" date NOT NULL,
	"frequency" integer NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "citation" ADD COLUMN "normalized_url" text;--> statement-breakpoint
ALTER TABLE "citation" ADD COLUMN "domain" text;--> statement-breakpoint
ALTER TABLE "citation_source_aggregate" ADD CONSTRAINT "citation_source_aggregate_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation_source_aggregate" ADD CONSTRAINT "citation_source_aggregate_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation_source_aggregate" ADD CONSTRAINT "citation_source_aggregate_prompt_set_id_prompt_set_id_fk" FOREIGN KEY ("prompt_set_id") REFERENCES "public"."prompt_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "csa_unique_idx" ON "citation_source_aggregate" USING btree ("workspace_id","prompt_set_id","brand_id","platform_id","locale","domain","period_start");--> statement-breakpoint
CREATE INDEX "csa_workspace_id_idx" ON "citation_source_aggregate" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "csa_brand_id_idx" ON "citation_source_aggregate" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "csa_prompt_set_id_idx" ON "citation_source_aggregate" USING btree ("prompt_set_id");--> statement-breakpoint
CREATE INDEX "csa_workspace_promptset_period_idx" ON "citation_source_aggregate" USING btree ("workspace_id","prompt_set_id","period_start");--> statement-breakpoint
CREATE INDEX "csa_workspace_domain_idx" ON "citation_source_aggregate" USING btree ("workspace_id","domain");--> statement-breakpoint
CREATE INDEX "citation_workspace_domain_idx" ON "citation" USING btree ("workspace_id","domain");