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

export const ForeignKeySchema = z
  .object({
    name: z.string().min(1),
    columns: z.array(z.string().min(1)).min(1),
    references: z.object({
      schema: z.string().min(1),
      table: z.string().min(1),
      columns: z.array(z.string().min(1)).min(1),
    }),
  })
  .refine((fk) => fk.columns.length === fk.references.columns.length, {
    message: "foreign key local/referenced column counts must match",
    path: ["columns"],
  });

export type ForeignKey = z.infer<typeof ForeignKeySchema>;

export const EntitySchema = z
  .object({
    name: z.string().min(1),
    schema: z.string().min(1),
    columns: z.array(ColumnSchema).min(1),
    primaryKey: z.array(z.string().min(1)).min(1),
    uniqueKeys: z.array(z.array(z.string()).min(1)).optional(),
    foreignKeys: z.array(ForeignKeySchema).optional(),
    comment: z.string().optional(),
  })
  .refine((e) => e.primaryKey.every((pk) => e.columns.some((c) => c.name === pk)), {
    message: "primaryKey columns must exist on the entity",
    path: ["primaryKey"],
  })
  .refine(
    (e) =>
      (e.foreignKeys ?? []).every((fk) =>
        fk.columns.every((c) => e.columns.some((col) => col.name === c)),
      ),
    { message: "foreign key columns must exist on the entity", path: ["foreignKeys"] },
  );

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
export type CreateMode = "create" | "orReplace";

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
    createMode: z.enum(["create", "orReplace"]),
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

export const CardinalitySchema = z.enum(["1:1", "1:N"]);
export type Cardinality = z.infer<typeof CardinalitySchema>;

export const RelationshipSchema = z.object({
  name: z.string().min(1),
  from: z.object({
    schema: z.string().min(1),
    table: z.string().min(1),
    columns: z.array(z.string().min(1)).min(1),
  }),
  to: z.object({
    schema: z.string().min(1),
    table: z.string().min(1),
    columns: z.array(z.string().min(1)).min(1),
  }),
  cardinality: CardinalitySchema,
});

export type Relationship = z.infer<typeof RelationshipSchema>;

export const ProjectSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().optional(),
    entities: z.array(EntitySchema),
    views: z.array(DualityViewSchema),
  })
  .refine(
    (p) => {
      const keys = p.entities.map((e) => `${e.schema}.${e.name}`);
      return new Set(keys).size === keys.length;
    },
    { message: "duplicate entity (schema.name) in project", path: ["entities"] },
  );

export type Project = z.infer<typeof ProjectSchema>;

// Draft entity: identical to EntitySchema but primaryKey may be empty.
// Used for freshly imported schemas where a table has no PK yet (the validator
// surfaces a PK_REQUIRED issue; the user adds a key before this becomes a Project).
export const DraftEntitySchema = z
  .object({
    name: z.string().min(1),
    schema: z.string().min(1),
    columns: z.array(ColumnSchema).min(1),
    primaryKey: z.array(z.string().min(1)),
    uniqueKeys: z.array(z.array(z.string()).min(1)).optional(),
    foreignKeys: z.array(ForeignKeySchema).optional(),
    comment: z.string().optional(),
  })
  .refine((e) => e.primaryKey.every((pk) => e.columns.some((c) => c.name === pk)), {
    message: "primaryKey columns must exist on the entity",
    path: ["primaryKey"],
  })
  .refine(
    (e) =>
      (e.foreignKeys ?? []).every((fk) =>
        fk.columns.every((c) => e.columns.some((col) => col.name === c)),
      ),
    { message: "foreign key columns must exist on the entity", path: ["foreignKeys"] },
  );

export type DraftEntity = z.infer<typeof DraftEntitySchema>;

export const DraftProjectSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().optional(),
    entities: z.array(DraftEntitySchema),
    views: z.array(DualityViewSchema),
  })
  .refine(
    (p) => {
      const keys = p.entities.map((e) => `${e.schema}.${e.name}`);
      return new Set(keys).size === keys.length;
    },
    { message: "duplicate entity (schema.name) in project", path: ["entities"] },
  );

export type DraftProject = z.infer<typeof DraftProjectSchema>;
