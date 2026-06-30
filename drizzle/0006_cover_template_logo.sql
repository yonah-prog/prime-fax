ALTER TABLE "cover_sheet_templates" ADD COLUMN IF NOT EXISTS "logo_url" text;
--> statement-breakpoint
INSERT INTO "cover_sheet_templates" ("name", "cover_sheet_message", "is_default")
SELECT 'Basic Cover Sheet', NULL, false
WHERE NOT EXISTS (SELECT 1 FROM "cover_sheet_templates" WHERE "name" = 'Basic Cover Sheet');
