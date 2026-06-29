import { pgTable, uuid, text, timestamp, integer, pgEnum, boolean, unique } from "drizzle-orm/pg-core"

export const faxDirectionEnum = pgEnum("fax_direction", ["inbound", "outbound"])
export const faxStatusEnum = pgEnum("fax_status", ["queued", "sending", "delivered", "failed", "received", "scheduled"])
export const userRoleEnum = pgEnum("user_role", ["admin", "staff"])
export const pageSizeEnum = pgEnum("page_size", ["letter", "legal", "a4"])
export const resolutionEnum = pgEnum("fax_resolution", ["fine", "standard"])

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("staff"),
  notifyInbound: boolean("notify_inbound").default(true).notNull(),
  notifyEmail: text("notify_email"),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiry: timestamp("google_token_expiry"),
  googleDriveFolder: text("google_drive_folder"),
  assignedNumberId: uuid("assigned_number_id"),
  canViewInbound: boolean("can_view_inbound").default(true).notNull(),
  canViewAllSent: boolean("can_view_all_sent").default(true).notNull(),
  canDelete: boolean("can_delete").default(false).notNull(),
  secureMode: boolean("secure_mode").default(false).notNull(),
  require2FA: boolean("require_2fa").default(false).notNull(),
  locked: boolean("locked").default(false).notNull(),
  timezone: text("timezone").default("America/New_York").notNull(),
  defaultPage: text("default_page").default("/sent").notNull(),
  markAsRead: text("mark_as_read").default("any").notNull(),
  downloadFormat: text("download_format").default("pdf").notNull(),
  defaultPageSize: pageSizeEnum("default_page_size").default("letter").notNull(),
  defaultResolution: resolutionEnum("default_resolution").default("fine").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const coverSheetTemplates = pgTable("cover_sheet_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  fromName: text("from_name"),
  coverSheetMessage: text("cover_sheet_message"),
  contactInfo: text("contact_info"),
  isDefault: boolean("is_default").default(false).notNull(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const phoneNumbers = pgTable("phone_numbers", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number").notNull().unique(),
  label: text("label"),
  deptName: text("dept_name"),
  callerIdStatus: text("caller_id_status").default("pending").notNull(),
  telnyxNumberId: text("telnyx_number_id"),
  active: boolean("active").default(true).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  coverSheetTemplateId: uuid("cover_sheet_template_id").references(() => coverSheetTemplates.id, { onDelete: "set null" }),
  googleDriveFolder: text("google_drive_folder"),
  forwardToNumber: text("forward_to_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const faxes = pgTable("faxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  direction: faxDirectionEnum("direction").notNull(),
  status: faxStatusEnum("status").notNull().default("queued"),
  fromNumber: text("from_number").notNull(),
  fromName: text("from_name"),
  toNumber: text("to_number").notNull(),
  recipientName: text("recipient_name"),
  subject: text("subject"),
  hasCoverSheet: boolean("has_cover_sheet").default(false).notNull(),
  coverSheetMessage: text("cover_sheet_message"),
  contactInfo: text("contact_info"),
  pageSize: pageSizeEnum("page_size").default("letter").notNull(),
  resolution: resolutionEnum("resolution").default("fine").notNull(),
  telnyxFaxId: text("telnyx_fax_id").unique(),
  humblefaxId: text("humblefax_id").unique(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  pages: integer("pages"),
  notes: text("notes"),
  errorMessage: text("error_message"),
  scheduledAt: timestamp("scheduled_at"),
  readAt: timestamp("read_at"),
  trashedAt: timestamp("trashed_at"),
  broadcastId: uuid("broadcast_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  faxNumber: text("fax_number").notNull(),
  company: text("company"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const blockedNumbers = pgTable("blocked_numbers", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number").notNull().unique(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  userEmail: text("user_email"),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  meta: text("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const userPhoneNumbers = pgTable("user_phone_numbers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNumberId: uuid("phone_number_id").notNull().references(() => phoneNumbers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique("upn_user_number").on(t.userId, t.phoneNumberId)])

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const userGroups = pgTable("user_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique("ug_user_group").on(t.userId, t.groupId)])

export type User = typeof users.$inferSelect
export type Fax = typeof faxes.$inferSelect
export type PhoneNumber = typeof phoneNumbers.$inferSelect
export type CoverSheetTemplate = typeof coverSheetTemplates.$inferSelect
export type Contact = typeof contacts.$inferSelect
export type BlockedNumber = typeof blockedNumbers.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type UserPhoneNumber = typeof userPhoneNumbers.$inferSelect
export type Group = typeof groups.$inferSelect
export type UserGroup = typeof userGroups.$inferSelect
