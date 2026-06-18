CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ug_user_group" UNIQUE("user_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD COLUMN "dept_name" text;--> statement-breakpoint
ALTER TABLE "phone_numbers" ADD COLUMN "caller_id_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "assigned_number_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_view_inbound" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_view_all_sent" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_delete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "secure_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "require_2fa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text DEFAULT 'America/New_York' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_page" text DEFAULT '/sent' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mark_as_read" text DEFAULT 'any' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "download_format" text DEFAULT 'pdf' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_page_size" "page_size" DEFAULT 'letter' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_resolution" "fax_resolution" DEFAULT 'fine' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;