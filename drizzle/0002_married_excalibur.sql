CREATE TABLE "brand" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(63) NOT NULL,
	"domain" text,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand" ADD CONSTRAINT "brand_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_workspace_id_idx" ON "brand" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_workspace_slug_idx" ON "brand" USING btree ("workspace_id","slug") WHERE "brand"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_workspace_name_idx" ON "brand" USING btree ("workspace_id","name") WHERE "brand"."deleted_at" is null;