// @tested-by: packages/model/src/__tests__/view-schemas.test.ts
import { z } from "zod";
import { SUPPORTED_TYPES } from "./types";

export const ColumnSchema = z.object({
  name: z.string().min(1),
  type: z.enum(SUPPORTED_TYPES),
  nullable: z.boolean(),
  precision: z.number().int().optional(),
  scale: z.number().int().optional(),
  length: z.number().int().optional(),
  default: z.string().optional(),
  comment: z.string().optional(),
});

export const EntitySchema = z
  .object({
    name: z.string().min(1),
    schema: z.string().min(1),
    columns: z.array(ColumnSchema).min(1),
    primaryKey: z.array(z.string().min(1)).min(1),
    uniqueKeys: z.array(z.array(z.string()).min(1)).optional(),
    comment: z.string().optional(),
  })
  .refine((e) => e.primaryKey.every((pk) => e.columns.some((c) => c.name === pk)), {
    message: "primaryKey columns must exist on the entity",
    path: ["primaryKey"],
  });

export type Entity = z.infer<typeof EntitySchema>;
export type Column = z.infer<typeof ColumnSchema>;

export const PermissionsSchema = z.object({
  insert: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
});

export const EtagPolicySchema = z.enum(["check", "nocheck"]);

export type Permissions = z.infer<typeof PermissionsSchema>;
export type EtagPolicy = z.infer<typeof EtagPolicySchema>;
export type CreateMode = "create" | "orReplace" | "ifNotExists";

const ScalarFieldSchema = z.object({
  key: z.string().min(1),
  source: z.string().min(1),
  etag: EtagPolicySchema.optional(),
  noupdate: z.boolean().optional(),
});

const NestedFieldSchema = z.object({
  key: z.string().min(1),
  kind: z.enum(["object", "unnest", "array"]),
  table: z.string().min(1),
  permissions: PermissionsSchema.optional(),
  etag: EtagPolicySchema.optional(),
  link: z.array(z.string()).optional(),
  // fields is added via intersection after AnyFieldSchema is defined
});

// Exported field types derived purely from Zod inference
export type ScalarField = z.infer<typeof ScalarFieldSchema>;
export type NestedField = z.infer<typeof NestedFieldSchema> & { fields: AnyField[] };
// ObjectField and ArrayField are discriminated subsets of NestedField
export type ObjectField = Omit<NestedField, "kind"> & { kind: "object" | "unnest" };
export type ArrayField = Omit<NestedField, "kind"> & { kind: "array" };
export type AnyField = ScalarField | NestedField;

// Recursive Zod schema typed against AnyField
const AnyFieldSchema: z.ZodType<AnyField> = z.lazy(() =>
  z.union([
    ScalarFieldSchema,
    NestedFieldSchema.extend({
      fields: z.array(AnyFieldSchema).min(1),
    }),
  ]),
);

export const DualityViewSchema = z
  .object({
    name: z.string().min(1),
    schema: z.string().min(1),
    createMode: z.enum(["create", "orReplace", "ifNotExists"]),
    replication: z.enum(["enable", "disable"]).optional(),
    root: z.object({
      table: z.string().min(1),
      permissions: PermissionsSchema,
      etag: EtagPolicySchema,
    }),
    fields: z.array(AnyFieldSchema).min(1),
  })
  .refine((v) => v.fields[0]?.key === "_id", {
    message: "first field must be _id",
    path: ["fields", 0],
  });

export type DualityView = z.infer<typeof DualityViewSchema>;
