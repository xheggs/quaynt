CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'generating', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."recipient_type" AS ENUM('email', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."schedule_format" AS ENUM('pdf', 'csv', 'json');--> statement-breakpoint
CREATE TYPE "public"."schedule_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TABLE "report_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"schedule_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"report_job_id" text,
	"recipient_id" text NOT NULL,
	"format" text NOT NULL,
	"file_path" text,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"created_by" text NOT NULL,
	"name" text NOT NULL,
	"frequency" "schedule_frequency" NOT NULL,
	"hour" integer DEFAULT 9 NOT NULL,
	"day_of_week" integer DEFAULT 1 NOT NULL,
	"day_of_month" integer DEFAULT 1 NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"format" "schedule_format" DEFAULT 'pdf' NOT NULL,
	"scope" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_recipient" (
	"id" text PRIMARY KEY NOT NULL,
	"schedule_id" text NOT NULL,
	"type" "recipient_type" NOT NULL,
	"address" text NOT NULL,
	"unsubscribed" boolean DEFAULT false NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_delivery" ADD CONSTRAINT "report_delivery_schedule_id_report_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."report_schedule"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_delivery" ADD CONSTRAINT "report_delivery_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_delivery" ADD CONSTRAINT "report_delivery_recipient_id_schedule_recipient_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."schedule_recipient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedule" ADD CONSTRAINT "report_schedule_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_recipient" ADD CONSTRAINT "schedule_recipient_schedule_id_report_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."report_schedule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_delivery_schedule_created_idx" ON "report_delivery" USING btree ("schedule_id","created_at");--> statement-breakpoint
CREATE INDEX "report_delivery_workspace_idx" ON "report_delivery" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_schedule_ws_name_idx" ON "report_schedule" USING btree ("workspace_id","name") WHERE "report_schedule"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "report_schedule_due_idx" ON "report_schedule" USING btree ("enabled","deleted_at","next_run_at") WHERE "report_schedule"."enabled" = true AND "report_schedule"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "report_schedule_workspace_id_idx" ON "report_schedule" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_recipient_schedule_type_address_idx" ON "schedule_recipient" USING btree ("schedule_id","type","address");--> statement-breakpoint
CREATE INDEX "schedule_recipient_active_idx" ON "schedule_recipient" USING btree ("schedule_id") WHERE "schedule_recipient"."unsubscribed" = false;