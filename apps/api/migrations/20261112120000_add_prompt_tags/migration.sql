ALTER TABLE "PromptTemplate"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "PromptVersion"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "PromptVersion" AS version
SET "tags" = template."tags"
FROM "PromptTemplate" AS template
WHERE version."promptTemplateId" = template."id";
