ALTER TABLE "conversations" ADD COLUMN "temporary" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "kept_alive_at" timestamp with time zone;