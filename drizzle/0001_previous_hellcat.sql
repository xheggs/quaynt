CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "webhook_endpoint" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"secret" text NOT NULL,
	"events" text[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"disabled_at" timestamp with time zone,
	"disabled_reason" text,
	"failing_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_endpoint_id" text NOT NULL,
	"webhook_event_id" text NOT NULL,
	"attempt_number" integer DEFAULT 0 NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"http_status" integer,
	"response_body" text,
	"response_latency_ms" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "webhook_endpoint_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_event" ADD CONSTRAINT "webhook_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_webhook_endpoint_id_webhook_endpoint_id_fk" FOREIGN KEY ("webhook_endpoint_id") REFERENCES "public"."webhook_endpoint"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_webhook_event_id_webhook_event_id_fk" FOREIGN KEY ("webhook_event_id") REFERENCES "public"."webhook_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_endpoint_workspace_id_idx" ON "webhook_endpoint" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "webhook_event_workspace_id_idx" ON "webhook_event" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "webhook_event_event_type_idx" ON "webhook_event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "webhook_event_created_at_idx" ON "webhook_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_delivery_endpoint_id_idx" ON "webhook_delivery" USING btree ("webhook_endpoint_id");--> statement-breakpoint
CREATE INDEX "webhook_delivery_event_id_idx" ON "webhook_delivery" USING btree ("webhook_event_id");--> statement-breakpoint
CREATE INDEX "webhook_delivery_status_idx" ON "webhook_delivery" USING btree ("status");--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "webhook_endpoint"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();