ALTER TABLE "alert_event" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alert_event" ADD COLUMN "snoozed_until" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "alert_event_workspace_severity_ack_idx" ON "alert_event" USING btree ("workspace_id","severity","acknowledged_at");--> statement-breakpoint
CREATE INDEX "alert_event_workspace_snoozed_idx" ON "alert_event" USING btree ("workspace_id","snoozed_until");