import type { AnyField, DualityView, NestedField, ScalarField } from "@jrdm/model";

export function scalarField(key: string, table: string, column: string): ScalarField {
  return { key, source: `${table}.${column}` };
}

export function nestedField(key: string, kind: NestedField["kind"], table: string): NestedField {
  return { key, kind, table, fields: [] };
}

function isNested(f: AnyField): f is NestedField {
  return "kind" in f;
}

export function getField(view: DualityView, path: number[]): AnyField | undefined {
  let fields: AnyField[] = view.fields;
  let node: AnyField | undefined;
  for (const idx of path) {
    node = fields[idx];
    if (!node) return undefined;
    fields = isNested(node) ? node.fields : [];
  }
  return node;
}

function mapAt(
  fields: AnyField[],
  path: number[],
  fn: (siblings: AnyField[]) => AnyField[],
): AnyField[] {
  if (path.length === 0) return fn(fields);
  const [head, ...rest] = path;
  return fields.map((f, i) => {
    if (i !== head || !isNested(f)) return f;
    return { ...f, fields: mapAt(f.fields, rest, fn) };
  });
}

export function addField(view: DualityView, parentPath: number[], field: AnyField): DualityView {
  return {
    ...view,
    fields: mapAt(view.fields, parentPath, (siblings) => [...siblings, field]),
  };
}

export function removeField(view: DualityView, path: number[]): DualityView {
  const parent = path.slice(0, -1);
  const idx = path[path.length - 1];
  return {
    ...view,
    fields: mapAt(view.fields, parent, (siblings) => siblings.filter((_, i) => i !== idx)),
  };
}

export function patchField(
  view: DualityView,
  path: number[],
  patch: Partial<ScalarField> & Partial<NestedField>,
): DualityView {
  const parent = path.slice(0, -1);
  const idx = path[path.length - 1];
  return {
    ...view,
    fields: mapAt(view.fields, parent, (siblings) =>
      siblings.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    ),
  };
}

export function resolveAddTargetPath(
  view: DualityView,
  selectedFieldPath: number[] | null,
): number[] {
  if (!selectedFieldPath) return [];
  const f = getField(view, selectedFieldPath);
  if (f && "kind" in f) return selectedFieldPath;
  return [];
}

export function flattenPaths(view: DualityView): number[][] {
  const out: number[][] = [];
  const walk = (fields: AnyField[], prefix: number[]) => {
    fields.forEach((f, i) => {
      const p = [...prefix, i];
      out.push(p);
      if ("kind" in f) walk(f.fields, p);
    });
  };
  walk(view.fields, []);
  return out;
}
