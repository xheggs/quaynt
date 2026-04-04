CREATE TABLE "alert_event" (
	"id" text PRIMARY KEY NOT NULL,
	"alert_rule_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"severity" text NOT NULL,
	"metric_value" numeric(12, 4) NOT NULL,
	"previous_value" numeric(12, 4),
	"threshold" numeric(12, 4) NOT NULL,
	"condition" text NOT NULL,
	"scope_snapshot" jsonb NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"metric" text NOT NULL,
	"prompt_set_id" text NOT NULL,
	"scope" jsonb NOT NULL,
	"condition" text NOT NULL,
	"threshold" numeric(12, 4) NOT NULL,
	"direction" text DEFAULT 'any' NOT NULL,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_evaluated_at" timestamp with time zone,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_event" ADD CONSTRAINT "alert_event_alert_rule_id_alert_rule_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_event" ADD CONSTRAINT "alert_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_prompt_set_id_prompt_set_id_fk" FOREIGN KEY ("prompt_set_id") REFERENCES "public"."prompt_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_event_rule_idx" ON "alert_event" USING btree ("alert_rule_id","triggered_at");--> statement-breakpoint
CREATE INDEX "alert_event_workspace_idx" ON "alert_event" USING btree ("workspace_id","triggered_at");--> statement-breakpoint
CREATE INDEX "alert_rule_workspace_metric_prompt_set_idx" ON "alert_rule" USING btree ("workspace_id","metric","prompt_set_id") WHERE "alert_rule"."enabled" = true;--> statement-breakpoint
CREATE INDEX "alert_rule_workspace_idx" ON "alert_rule" USING btree ("workspace_id");