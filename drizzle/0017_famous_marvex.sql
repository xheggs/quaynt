DROP INDEX "notification_log_event_user_channel_idx";--> statement-breakpoint
DROP INDEX "notification_preference_ws_user_channel_idx";--> statement-breakpoint
ALTER TABLE "notification_log" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_log" ALTER COLUMN "recipient_email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preference" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_log" ADD COLUMN "recipient" text;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_log_event_channel_recipient_idx" ON "notification_log" USING btree ("alert_event_id","channel","recipient") WHERE "notification_log"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preference_ws_channel_no_user_idx" ON "notification_preference" USING btree ("workspace_id","channel") WHERE "notification_preference"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_log_event_user_channel_idx" ON "notification_log" USING btree ("alert_event_id","user_id","channel") WHERE "notification_log"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preference_ws_user_channel_idx" ON "notification_preference" USING btree ("workspace_id","user_id","channel") WHERE "notification_preference"."user_id" IS NOT NULL;