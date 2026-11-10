CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "answers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Participant_orderLineId_idx" ON "Participant"("orderLineId");

ALTER TABLE "Participant"
    ADD CONSTRAINT "Participant_orderLineId_fkey"
    FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing event lines stored participant data in OrderLine.answers. Move it
-- into one first-class row per purchased spot while keeping the old line data
-- available for rollback/audit.
WITH event_lines AS (
    SELECT
        ol."id",
        ol."quantity",
        COALESCE(ol."answers", '[]'::jsonb) AS answers,
        COALESCE(
            (
                SELECT CASE
                    WHEN jsonb_typeof(answer->'answer') = 'array' THEN answer->'answer'
                    ELSE jsonb_build_array(answer->'answer')
                END
                FROM jsonb_array_elements(COALESCE(ol."answers", '[]'::jsonb)) AS answer
                WHERE answer->>'questionId' = 'osallistujan-nimi'
                LIMIT 1
            ),
            '[]'::jsonb
        ) AS names
    FROM "OrderLine" ol
    JOIN "Item" i ON i."id" = ol."itemId"
    WHERE i."isEvent" = true
)
INSERT INTO "Participant" ("id", "orderLineId", "name", "answers")
SELECT
    md5(event_lines."id" || '-' || participant_index::text),
    event_lines."id",
    COALESCE(event_lines.names->>(participant_index - 1), 'Osallistuja ' || participant_index::text),
    COALESCE((
        SELECT jsonb_agg(
            CASE
                WHEN snapshot->>'prompt' LIKE '% ' || participant_index::text
                    THEN jsonb_set(
                        snapshot,
                        '{prompt}',
                        to_jsonb(regexp_replace(snapshot->>'prompt', ' ' || participant_index::text || '$', ''))
                    )
                ELSE snapshot
            END
            ORDER BY snapshot_order
        )
        FROM jsonb_array_elements(event_lines.answers) WITH ORDINALITY AS snapshots(snapshot, snapshot_order)
        WHERE snapshot->>'questionId' <> 'osallistujan-nimi'
          AND (
              snapshot->>'prompt' LIKE '% ' || participant_index::text
              OR snapshot->>'prompt' !~ ' [0-9]+$'
          )
    ), '[]'::jsonb)
FROM event_lines
CROSS JOIN LATERAL generate_series(1, GREATEST(event_lines."quantity", 1)) AS participant_index;
