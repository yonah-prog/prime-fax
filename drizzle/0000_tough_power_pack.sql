CREATE TYPE "public"."fax_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."fax_status" AS ENUM('queued', 'sending', 'delivered', 'failed', 'received', 'scheduled');--> statement-breakpoint
CREATE TYPE "public"."page_size" AS ENUM('letter', 'legal', 'a4');--> statement-breakpoint
CREATE TYPE "public"."fax_resolution" AS ENUM('fine', 'standard');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'staff');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_email" text,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"meta" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocked_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_numbers_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"fax_number" text NOT NULL,
	"company" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cover_sheet_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"from_name" text,
	"cover_sheet_message" text,
	"contact_info" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"direction" "fax_direction" NOT NULL,
	"status" "fax_status" DEFAULT 'queued' NOT NULL,
	"from_number" text NOT NULL,
	"from_name" text,
	"to_number" text NOT NULL,
	"recipient_name" text,
	"subject" text,
	"has_cover_sheet" boolean DEFAULT false NOT NULL,
	"cover_sheet_message" text,
	"contact_info" text,
	"page_size" "page_size" DEFAULT 'letter' NOT NULL,
	"resolution" "fax_resolution" DEFAULT 'fine' NOT NULL,
	"telnyx_fax_id" text,
	"humblefax_id" text,
	"file_url" text,
	"file_name" text,
	"pages" integer,
	"notes" text,
	"error_message" text,
	"scheduled_at" timestamp,
	"read_at" timestamp,
	"trashed_at" timestamp,
	"broadcast_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "faxes_telnyx_fax_id_unique" UNIQUE("telnyx_fax_id"),
	CONSTRAINT "faxes_humblefax_id_unique" UNIQUE("humblefax_id")
);
--> statement-breakpoint
CREATE TABLE "phone_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"label" text,
	"telnyx_number_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "phone_numbers_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "user_phone_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone_number_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "upn_user_number" UNIQUE("user_id","phone_number_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"notify_inbound" boolean DEFAULT true NOT NULL,
	"notify_email" text,
	"google_access_token" text,
	"google_refresh_token" text,
	"google_token_expiry" timestamp,
	"google_drive_folder" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faxes" ADD CONSTRAINT "faxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_phone_numbers" ADD CONSTRAINT "user_phone_numbers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_phone_numbers" ADD CONSTRAINT "user_phone_numbers_phone_number_id_phone_numbers_id_fk" FOREIGN KEY ("phone_number_id") REFERENCES "public"."phone_numbers"("id") ON DELETE cascade ON UPDATE no action;