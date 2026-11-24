-- The turn timing no longer carries token counts: usage lives in model_calls. Removes `usage` from every stored step.
UPDATE "messages"
SET "metadata" = jsonb_set(
  "metadata",
  '{turnTiming,steps}',
  (
    SELECT coalesce(jsonb_agg(step.value - 'usage' ORDER BY step.ordinality), '[]'::jsonb)
    FROM jsonb_array_elements("metadata" -> 'turnTiming' -> 'steps') WITH ORDINALITY AS step(value, ordinality)
  )
)
WHERE jsonb_typeof("metadata" -> 'turnTiming' -> 'steps') = 'array';
