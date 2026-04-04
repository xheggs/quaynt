CREATE TABLE "platform_adapter" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"credentials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rate_limit_points" integer DEFAULT 60 NOT NULL,
	"rate_limit_duration" integer DEFAULT 60 NOT NULL,
	"timeout_ms" integer DEFAULT 30000 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"circuit_breaker_threshold" integer DEFAULT 50 NOT NULL,
	"circuit_breaker_reset_ms" integer DEFAULT 60000 NOT NULL,
	"last_health_status" text,
	"last_health_checked_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_adapter" ADD CONSTRAINT "platform_adapter_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_adapter_workspace_id_idx" ON "platform_adapter" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_adapter_workspace_platform_idx" ON "platform_adapter" USING btree ("workspace_id","platform_id") WHERE "platform_adapter"."deleted_at" is null;