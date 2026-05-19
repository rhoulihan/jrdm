import {
  ProjectSchema,
  DraftProjectSchema,
  type DraftProject,
  type Relationship,
} from "@jrdm/model";
import { validateProject, type Issue } from "@jrdm/validator";
import { TABLES_SQL, COLUMNS_SQL, PK_UK_SQL, FK_SQL } from "./dictionary-sql";
import { mapRowsToEntities, type ColumnRow, type KeyRow, type FkRow } from "./map";
import { classifyCardinality } from "./cardinality";

export type QueryExec = <T>(sql: string, binds?: Record<string, unknown>) => Promise<T[]>;

export interface ImportOptions {
  schemaOwner: string;
  projectName: string;
  projectVersion?: string;
}

export interface ImportResult {
  project: DraftProject;
  relationships: Relationship[];
  issues: Issue[];
}

export async function importSchema(exec: QueryExec, opts: ImportOptions): Promise<ImportResult> {
  const ownerBind = { owner: opts.schemaOwner };
  const tableRows = await exec<{ TABLE_NAME: string }>(TABLES_SQL, ownerBind);
  const columns = await exec<ColumnRow>(COLUMNS_SQL, ownerBind);
  const keys = await exec<KeyRow>(PK_UK_SQL, ownerBind);
  const fks = await exec<FkRow>(FK_SQL, ownerBind);

  const tableNames = tableRows.map((r) => r.TABLE_NAME);
  const { entities, unmapped } = mapRowsToEntities(
    opts.schemaOwner,
    tableNames,
    columns,
    keys,
    fks,
  );
  const { relationships } = classifyCardinality(entities);

  const project: DraftProject = {
    name: opts.projectName,
    version: opts.projectVersion ?? "0.1.0",
    entities,
    views: [],
  };

  const issues = validateProject(project);

  for (const u of unmapped) {
    issues.push({
      code: "UNMAPPED_TYPE",
      severity: "warning",
      message: `Column ${u.table}.${u.column} has Oracle type ${u.original}; defaulted to VARCHAR2 — review before generating DDL`,
      path: ["entities", u.table, "columns", u.column],
    });
  }

  // A DraftProject with no PK_REQUIRED issue is a fully valid Project; assert that
  // invariant. When PK_REQUIRED is present, the project stays a DraftProject (entity
  // primaryKey: []) — still structurally valid as a DraftProject, returned with issues
  // for the UI to surface. Always validate as a DraftProject so a malformed import
  // (e.g. zero-column table) still throws loudly.
  DraftProjectSchema.parse(project);
  if (!issues.some((i) => i.code === "PK_REQUIRED")) {
    ProjectSchema.parse(project);
  }

  return { project, relationships, issues };
}
