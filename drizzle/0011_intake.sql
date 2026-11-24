ALTER TABLE "phone_numbers" ADD COLUMN IF NOT EXISTS "intake_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "faxes" ADD COLUMN IF NOT EXISTS "reference_id" text;--> statement-breakpoint
ALTER TABLE "faxes" ADD COLUMN IF NOT EXISTS "intake_notified_at" timestamp;
