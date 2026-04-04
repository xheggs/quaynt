CREATE TABLE "notification_log" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"alert_event_id" text NOT NULL,
	"digest_batch_id" text,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text,
	"message_id" text,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"digest_frequency" text DEFAULT 'immediate' NOT NULL,
	"digest_hour" integer DEFAULT 9 NOT NULL,
	"digest_day" integer DEFAULT 1 NOT NULL,
	"digest_timezone" text DEFAULT 'UTC' NOT NULL,
	"severity_filter" jsonb DEFAULT '["info","warning","critical"]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_alert_event_id_alert_event_id_fk" FOREIGN KEY ("alert_event_id") REFERENCES "public"."alert_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_log_event_user_channel_idx" ON "notification_log" USING btree ("alert_event_id","user_id","channel");--> statement-breakpoint
CREATE INDEX "notification_log_event_idx" ON "notification_log" USING btree ("alert_event_id");--> statement-breakpoint
CREATE INDEX "notification_log_ws_user_sent_idx" ON "notification_log" USING btree ("workspace_id","user_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preference_ws_user_channel_idx" ON "notification_preference" USING btree ("workspace_id","user_id","channel");--> statement-breakpoint
CREATE INDEX "notification_preference_ws_channel_enabled_idx" ON "notification_preference" USING btree ("workspace_id","channel") WHERE "notification_preference"."enabled" = true;