ALTER TABLE "cover_sheet_templates" ADD COLUMN "file_url" text;--> statement-breakpoint
ALTER TABLE "cover_sheet_templates" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD COLUMN "cover_sheet_template_id" uuid;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_cover_sheet_template_id_cover_sheet_templates_id_fk" FOREIGN KEY ("cover_sheet_template_id") REFERENCES "public"."cover_sheet_templates"("id") ON DELETE set null ON UPDATE no action;
