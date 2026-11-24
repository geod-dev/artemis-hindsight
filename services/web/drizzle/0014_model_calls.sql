CREATE TABLE "model_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"context" text NOT NULL,
	"operation" text NOT NULL,
	"cause" text NOT NULL,
	"model" text NOT NULL,
	"usage" jsonb NOT NULL,
	"cost_usd" numeric(14, 8) NOT NULL,
	"conversation_id" uuid,
	"message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_calls_source_key_unique" UNIQUE("source_key")
);
--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_calls_user_created_idx" ON "model_calls" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "model_calls_conversation_idx" ON "model_calls" USING btree ("conversation_id");