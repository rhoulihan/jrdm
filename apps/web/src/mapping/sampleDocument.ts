import type { AnyField, DualityView, Entity, DraftEntity } from "@jrdm/model";

type AnyEntity = Entity | DraftEntity;

/** Deterministic synthetic value for an Oracle column type (§5). */
function sampleForType(type: string | undefined): unknown {
  switch (type) {
    case "NUMBER":
    case "BINARY_DOUBLE":
    case "BINARY_FLOAT":
      return 123;
    case "VARCHAR2":
    case "NVARCHAR2":
    case "CHAR":
    case "NCHAR":
    case "CLOB":
    case "NCLOB":
      return "sample";
    case "DATE":
    case "TIMESTAMP":
    case "TIMESTAMP WITH TIME ZONE":
      return "2026-01-01T00:00:00.000Z";
    case "BOOLEAN":
      return true;
    default:
      return "sample";
  }
}

/** Resolve a scalar `source` ("table.column") to its Oracle type via entities. */
function columnType(source: string, entities: AnyEntity[]): string | undefined {
  const dot = source.indexOf(".");
  if (dot < 0) return undefined;
  const table = source.slice(0, dot);
  const column = source.slice(dot + 1);
  const ent = entities.find((e) => e.name === table);
  return ent?.columns.find((c) => c.name === column)?.type;
}

function buildFields(
  fields: AnyField[],
  entities: Entity[] | DraftEntity[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if ("kind" in f) {
      const shape = buildFields(f.fields, entities);
      out[f.key] = f.kind === "array" ? [shape, structuredClone(shape)] : shape;
    } else {
      out[f.key] = sampleForType(columnType(f.source, entities));
    }
  }
  return out;
}

/**
 * §5 — pure, deterministic synthetic sample document for the post-Save
 * preview (no live Oracle). Scalars map by source-column Oracle type;
 * object nodes nest; array nodes become a 2-element array of the child
 * shape; a synthetic `_metadata.etag` is added at the root only.
 */
export function sampleDocument(view: DualityView, entities: Entity[] | DraftEntity[]): unknown {
  const doc = buildFields(view.fields, entities);
  doc._metadata = { etag: "SAMPLE0000" };
  return doc;
}
