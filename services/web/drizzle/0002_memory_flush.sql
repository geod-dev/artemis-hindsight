ALTER TABLE "messages" ADD COLUMN "memorized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active_conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active_conversation_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_active_conversation_id_conversations_id_fk" FOREIGN KEY ("active_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;