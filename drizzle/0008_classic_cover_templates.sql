INSERT INTO "cover_sheet_templates" ("name", "file_url", "file_name", "is_default")
SELECT 'Classic — Premier Health', 'https://prime-fax-production.up.railway.app/cover-classic-premier.trdx', 'cover-classic-premier.trdx', false
WHERE NOT EXISTS (SELECT 1 FROM "cover_sheet_templates" WHERE "name" = 'Classic — Premier Health');
--> statement-breakpoint
INSERT INTO "cover_sheet_templates" ("name", "file_url", "file_name", "is_default")
SELECT 'Classic Form', 'https://prime-fax-production.up.railway.app/cover-classic-blank.trdx', 'cover-classic-blank.trdx', false
WHERE NOT EXISTS (SELECT 1 FROM "cover_sheet_templates" WHERE "name" = 'Classic Form');
