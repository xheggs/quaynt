ALTER TABLE "citation" ADD COLUMN "locale" text;--> statement-breakpoint
CREATE INDEX "citation_locale_idx" ON "citation" USING btree ("locale");--> statement-breakpoint
UPDATE "citation" SET "locale" = "model_run"."locale" FROM "model_run" WHERE "citation"."model_run_id" = "model_run"."id" AND "citation"."locale" IS NULL;