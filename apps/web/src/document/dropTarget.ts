export const DRAG_MIME = "application/x-jrdm-column";

export interface ColumnDrag {
  table: string;
  column: string;
}

export function parseDragPayload(raw: string): ColumnDrag | null {
  try {
    const j = JSON.parse(raw) as Partial<ColumnDrag>;
    if (typeof j.table === "string" && typeof j.column === "string") {
      return { table: j.table, column: j.column };
    }
    return null;
  } catch {
    return null;
  }
}
