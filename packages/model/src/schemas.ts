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
