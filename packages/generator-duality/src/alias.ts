/**
 * Collision-safe, deterministic table-alias allocator for one duality view.
 * First claimant of an initials-base gets the bare base; subsequent colliding
 * tables get a stable numeric suffix in claim order. Same table always maps to
 * the same alias within one context instance.
 */
export class AliasContext {
  private readonly byTable = new Map<string, string>();
  private readonly used = new Set<string>();

  private base(table: string): string {
    const parts = table.split("_").filter((p) => p.length > 0);
    if (parts.length <= 1) {
      return (table[0] ?? "t").toLowerCase();
    }
    return parts
      .map((p) => p[0])
      .join("")
      .toLowerCase();
  }

  aliasFor(table: string): string {
    const existing = this.byTable.get(table);
    if (existing !== undefined) return existing;

    const base = this.base(table);
    let candidate = base;
    let n = 1;
    while (this.used.has(candidate)) {
      n += 1;
      candidate = `${base}${n}`;
    }
    this.used.add(candidate);
    this.byTable.set(table, candidate);
    return candidate;
  }
}
