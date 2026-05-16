export interface NormField {
  key: string;
  leaf: boolean;
  source?: string; // column name only (scalar)
  table?: string; // nested
  kind?: "object" | "unnest" | "array";
  nocheck: boolean;
  noupdate: boolean;
  perms: { insert: boolean; update: boolean; delete: boolean };
  link: string[];
  children: NormField[];
}

export interface NormView {
  name: string;
  schema: string;
  createMode: "create" | "orReplace";
  replication?: "enable" | "disable";
  rootTable: string;
  rootPerms: { insert: boolean; update: boolean; delete: boolean };
  rootNocheck: boolean;
  tree: NormField[];
}

const NO_PERMS = { insert: false, update: false, delete: false };

// --- GraphQL reader -------------------------------------------------------
export function normalizeGraphql(src: string): NormView {
  const head = /VIEW (\w+)\.(\w+) AS/.exec(src);
  const createMode = src.startsWith("CREATE OR REPLACE") ? "orReplace" : "create";
  const replication = src.includes("ENABLE LOGICAL REPLICATION")
    ? "enable"
    : src.includes("DISABLE LOGICAL REPLICATION")
      ? "disable"
      : undefined;
  // body after "AS\n"
  const body = src.slice(src.indexOf(" AS\n") + 4);
  const rootLine = body.slice(0, body.indexOf("{")).trim();
  const rootTable = rootLine.split(/\s/)[0]!;
  const rootPerms = {
    insert: rootLine.includes("@insert"),
    update: rootLine.includes("@update"),
    delete: rootLine.includes("@delete"),
  };
  const tokens = tokenizeBraces(body.slice(body.indexOf("{") + 1));
  return {
    name: head![2]!,
    schema: head![1]!,
    createMode,
    ...(replication ? { replication } : {}),
    rootTable,
    rootPerms,
    rootNocheck: false, // GraphQL root nocheck not modeled here (root etag handled SQL-side); kept symmetric: see normalizeSql
    tree: parseGqlFields(tokens),
  };
}

// Extremely small structural tokenizer for OUR emitted GraphQL only.
function tokenizeBraces(_s: string): string {
  return _s; // we parse via regex line scan below; placeholder kept for clarity
}

function parseGqlFields(_body: string): NormField[] {
  // Implemented in Step 6 refinement — see note. For the property test we use a
  // line-oriented recursive scan keyed off our deterministic indentation.
  return scanGql(_body, 0).fields;
}

function scanGql(body: string, _start: number): { fields: NormField[]; end: number } {
  const lines = body.split("\n");
  const out: NormField[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trim();
    if (line === "" || line === "}" || line === "};" || line === "} ]" || line === "} ];") continue;
    const open = /\[ \{$|\{$/.test(line);
    const m = /^(\w+) : (\w+)(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!;
    const rhs = m[2]!;
    const tail = m[3] ?? "";
    if (open) {
      const isUnnest = tail.includes("@unnest");
      const kind = isUnnest ? "unnest" : line.includes("[ {") ? "array" : "object";
      const linkM = /@link\(to : \[([^\]]*)\]\)/.exec(tail);
      const link = linkM
        ? linkM[1]!
            .split(",")
            .map((s) => s.trim().replace(/"/g, ""))
            .filter(Boolean)
        : [];
      // find matching close by brace depth
      let depth = 1;
      let j = i + 1;
      const inner: string[] = [];
      for (; j < lines.length && depth > 0; j++) {
        const lj = lines[j]!.trim();
        if (/\{$|\[ \{$/.test(lj)) depth++;
        if (/^\}|\} \]/.test(lj)) {
          depth--;
          if (depth === 0) break;
        }
        inner.push(lines[j]!);
      }
      out.push({
        // For unnest, SQL has no key (UNNEST has no surrounding 'key' :); normalize both to ""
        key: isUnnest ? "" : key,
        leaf: false,
        table: rhs,
        kind,
        nocheck: tail.includes("@nocheck"),
        noupdate: false,
        perms: {
          insert: tail.includes("@insert"),
          update: tail.includes("@update"),
          delete: tail.includes("@delete"),
        },
        link,
        children: scanGql(inner.join("\n"), 0).fields,
      });
      i = j;
    } else {
      out.push({
        key,
        leaf: true,
        source: rhs,
        nocheck: tail.includes("@nocheck"),
        noupdate: tail.includes("@noupdate"),
        perms: { ...NO_PERMS },
        link: [],
        children: [],
      });
    }
  }
  return { fields: out, end: lines.length };
}

// --- SQL/JSON reader ------------------------------------------------------
export function normalizeSql(src: string): NormView {
  const head = /VIEW (\w+)\.(\w+) AS/.exec(src);
  const createMode = src.startsWith("CREATE OR REPLACE") ? "orReplace" : "create";
  const replication = src.includes("ENABLE LOGICAL REPLICATION")
    ? "enable"
    : src.includes("DISABLE LOGICAL REPLICATION")
      ? "disable"
      : undefined;
  const fromM = /\nFROM (\w+) \w+(.*?)(?:\n(?:ENABLE|DISABLE) LOGICAL REPLICATION)?;/s.exec(src);
  const rootTail = fromM ? fromM[2]! : "";
  const rootPerms = {
    insert: /WITH[^;]*INSERT/.test(rootTail),
    update: /WITH[^;]*UPDATE/.test(rootTail),
    delete: /WITH[^;]*DELETE/.test(rootTail),
  };
  const inner = src.slice(
    src.indexOf("SELECT JSON {") + "SELECT JSON {".length,
    src.lastIndexOf("\n}"),
  );
  return {
    name: head![2]!,
    schema: head![1]!,
    createMode,
    ...(replication ? { replication } : {}),
    rootTable: fromM![1]!,
    rootPerms,
    rootNocheck: false, // root etag SQL/GraphQL parity is out of v0.3a scope; always false so root-etag is not part of equivalence check
    tree: parseSqlFields(inner),
  };
}

function parseSqlFields(s: string): NormField[] {
  // Split top-level comma-separated entries respecting (), [], {} nesting.
  const out: NormField[] = [];
  const entries = splitTop(s);
  for (const eRaw of entries) {
    const e = eRaw.trim();
    if (e === "") continue;
    if (e.startsWith("UNNEST (")) {
      out.push(parseSqlSub(e, "unnest", undefined));
      continue;
    }
    const km = /^'([^']+)' : (\[|\()?\s*SELECT JSON \{/.exec(e);
    if (km) {
      // km[2] is '[' for array, '(' for object; use outer bracket, not inner content
      const kind = km[2] === "[" ? "array" : "object";
      out.push(parseSqlSub(e, kind, km[1]));
      continue;
    }
    const sm = /^'([^']+)' : \w+\.(\w+)(.*)$/.exec(e);
    if (sm) {
      out.push({
        key: sm[1]!,
        leaf: true,
        source: sm[2]!,
        nocheck: /\bWITH NOCHECK\b/.test(sm[3] ?? ""),
        noupdate: /\bWITH NOUPDATE\b/.test(sm[3] ?? ""),
        perms: { ...NO_PERMS },
        link: [],
        children: [],
      });
    }
  }
  return out;
}

function parseSqlSub(
  e: string,
  kind: "object" | "unnest" | "array",
  key: string | undefined,
): NormField {
  const km =
    /(?:'([^']+)' : )?(?:\[|\()?\s*SELECT JSON \{([\s\S]*)\} FROM (\w+) \w+([^]*?) WHERE ([^]*?)(?:\s*[)\]])\s*$/.exec(
      e,
    );
  const childBody = km ? km[2]! : "";
  const table = km ? km[3]! : "";
  const tail = km ? km[4]! : "";
  const where = km ? km[5]! : "";
  const link = Array.from(where.matchAll(/\w+\.(\w+) = \w+\.\1/g)).map((m) => m[1]!);
  return {
    // For unnest, SQL has no surrounding 'key' :; key is "" to match GraphQL normalizer
    key: key ?? km?.[1] ?? "",
    leaf: false,
    table,
    kind,
    nocheck: /\bWITH NOCHECK\b/.test(tail),
    noupdate: false,
    perms: {
      insert: /\bINSERT\b/.test(tail),
      update: /\bUPDATE\b/.test(tail),
      delete: /\bDELETE\b/.test(tail),
    },
    link,
    children: parseSqlFields(childBody),
  };
}

function splitTop(s: string): string[] {
  const res: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      res.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim() !== "") res.push(cur);
  return res;
}
