INSERT INTO "cover_sheet_templates" ("name", "file_url", "file_name", "is_default")
SELECT 'Clean & Modern', 'https://prime-fax-production.up.railway.app/cover-clean.trdx', 'cover-clean.trdx', false
WHERE NOT EXISTS (SELECT 1 FROM "cover_sheet_templates" WHERE "name" = 'Clean & Modern');
--> statement-breakpoint
INSERT INTO "cover_sheet_templates" ("name", "file_url", "file_name", "is_default")
SELECT 'Professional Dark', 'https://prime-fax-production.up.railway.app/cover-professional.trdx', 'cover-professional.trdx', false
WHERE NOT EXISTS (SELECT 1 FROM "cover_sheet_templates" WHERE "name" = 'Professional Dark');
