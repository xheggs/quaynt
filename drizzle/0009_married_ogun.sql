CREATE TYPE "public"."sentiment_label" AS ENUM('positive', 'neutral', 'negative');--> statement-breakpoint
ALTER TABLE "citation" ADD COLUMN "sentiment_label" "sentiment_label";--> statement-breakpoint
ALTER TABLE "citation" ADD COLUMN "sentiment_score" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "citation" ADD COLUMN "sentiment_confidence" numeric(3, 2);--> statement-breakpoint
CREATE INDEX "citation_workspace_sentiment_idx" ON "citation" USING btree ("workspace_id","sentiment_label");