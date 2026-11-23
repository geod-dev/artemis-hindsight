ALTER TABLE "conversations" ADD COLUMN "active_leaf_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "memorized_leaf_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "visited_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "messages_parent_idx" ON "messages" USING btree ("parent_id");--> statement-breakpoint
-- Every conversation stored so far is one branch: each message follows the one before it.
UPDATE "messages" AS m SET "parent_id" = p."prev_id"
FROM (
  SELECT "id", lag("id") OVER (PARTITION BY "conversation_id" ORDER BY "position") AS "prev_id" FROM "messages"
) AS p
WHERE m."id" = p."id";--> statement-breakpoint
UPDATE "conversations" AS c SET "active_leaf_id" = (
  SELECT m."id" FROM "messages" AS m WHERE m."conversation_id" = c."id" ORDER BY m."position" DESC LIMIT 1
);--> statement-breakpoint
UPDATE "conversations" AS c SET "memorized_leaf_id" = (
  SELECT m."id" FROM "messages" AS m
  WHERE m."conversation_id" = c."id" AND m."memorized_at" IS NOT NULL
  ORDER BY m."position" DESC LIMIT 1
);
