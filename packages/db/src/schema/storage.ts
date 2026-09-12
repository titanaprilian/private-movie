import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const storageProviders = pgTable("storage_providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  providerType: text("provider_type").notNull(),
  endpoint: text("endpoint").notNull(),
  region: text("region").notNull(),
  bucket: text("bucket").notNull(),
  accessKeyIdEnc: text("access_key_id_enc").notNull(),
  secretAccessKeyEnc: text("secret_access_key_enc").notNull(),
  publicBaseUrl: text("public_base_url"),
  forcePathStyle: boolean("force_path_style").notNull().default(false),
  storageLimitGb: integer("storage_limit_gb").notNull().default(50),
  isDefault: boolean("is_default").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type StorageProviderRow = typeof storageProviders.$inferSelect;
export type NewStorageProviderRow = typeof storageProviders.$inferInsert;
