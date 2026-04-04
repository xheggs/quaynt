CREATE TABLE "sentiment_aggregate" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"prompt_set_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"locale" text NOT NULL,
	"period_start" date NOT NULL,
	"positive_count" integer NOT NULL,
	"neutral_count" integer NOT NULL,
	"negative_count" integer NOT NULL,
	"total_count" integer NOT NULL,
	"positive_percentage" numeric(5, 2) NOT NULL,
	"neutral_percentage" numeric(5, 2) NOT NULL,
	"negative_percentage" numeric(5, 2) NOT NULL,
	"net_sentiment_score" numeric(6, 2) NOT NULL,
	"average_score" numeric(5, 4),
	"model_run_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sentiment_aggregate" ADD CONSTRAINT "sentiment_aggregate_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentiment_aggregate" ADD CONSTRAINT "sentiment_aggregate_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentiment_aggregate" ADD CONSTRAINT "sentiment_aggregate_prompt_set_id_prompt_set_id_fk" FOREIGN KEY ("prompt_set_id") REFERENCES "public"."prompt_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sentiment_aggregate_unique_idx" ON "sentiment_aggregate" USING btree ("workspace_id","prompt_set_id","brand_id","platform_id","locale","period_start");--> statement-breakpoint
CREATE INDEX "sentiment_aggregate_workspace_id_idx" ON "sentiment_aggregate" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sentiment_aggregate_brand_id_idx" ON "sentiment_aggregate" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "sentiment_aggregate_prompt_set_id_idx" ON "sentiment_aggregate" USING btree ("prompt_set_id");--> statement-breakpoint
CREATE INDEX "sentiment_aggregate_workspace_brand_period_idx" ON "sentiment_aggregate" USING btree ("workspace_id","brand_id","period_start");