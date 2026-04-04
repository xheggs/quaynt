CREATE TABLE "prompt_set" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt" (
	"id" text PRIMARY KEY NOT NULL,
	"prompt_set_id" text NOT NULL,
	"template" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prompt_set" ADD CONSTRAINT "prompt_set_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt" ADD CONSTRAINT "prompt_prompt_set_id_prompt_set_id_fk" FOREIGN KEY ("prompt_set_id") REFERENCES "public"."prompt_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prompt_set_workspace_id_idx" ON "prompt_set" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_set_workspace_name_idx" ON "prompt_set" USING btree ("workspace_id","name") WHERE "prompt_set"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "prompt_prompt_set_id_idx" ON "prompt" USING btree ("prompt_set_id");--> statement-breakpoint
CREATE INDEX "prompt_prompt_set_order_idx" ON "prompt" USING btree ("prompt_set_id","order");