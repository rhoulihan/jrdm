import { ProjectSchema, type Project, type Relationship } from "@jrdm/model";
import { validateProject, type Issue } from "@jrdm/validator";
import { TABLES_SQL, COLUMNS_SQL, PK_UK_SQL, FK_SQL } from "./dictionary-sql";
import { mapRowsToEntities, type ColumnRow, type KeyRow, type FkRow } from "./map";
import { classifyCardinality } from "./cardinality";

export type QueryExec = <T>(sql: string) => Promise<T[]>;

export interface ImportOptions {
  schemaOwner: string;
  projectName: string;
  projectVersion?: string;
}

export interface ImportResult {
  project: Project;
  relationships: Relationship[];
  issues: Issue[];
}

export async function importSchema(exec: QueryExec, opts: ImportOptions): Promise<ImportResult> {
  const tableRows = await exec<{ TABLE_NAME: string }>(TABLES_SQL);
  const columns = await exec<ColumnRow>(COLUMNS_SQL);
  const keys = await exec<KeyRow>(PK_UK_SQL);
  const fks = await exec<FkRow>(FK_SQL);

  const tableNames = tableRows.map((r) => r.TABLE_NAME);
  const entities = mapRowsToEntities(opts.schemaOwner, tableNames, columns, keys, fks);
  const { relationships } = classifyCardinality(entities);

  const project: Project = {
    name: opts.projectName,
    version: opts.projectVersion ?? "0.1.0",
    entities,
    views: [],
  };

  // Validate but do not throw — issues are returned for the UI to surface.
  const issues = validateProject(project);

  // The project must still be structurally parseable even if it has semantic issues
  // (e.g. a PK-less table). ProjectSchema does not require a PK at the schema level
  // (EntitySchema requires primaryKey.min(1)); a PK-less imported table is represented
  // with an empty primaryKey only in the in-memory Project. To keep ProjectSchema.parse
  // working, entities always carry primaryKey: [] which EntitySchema rejects.
  // Therefore: only run ProjectSchema.parse when there are no PK_REQUIRED issues;
  // otherwise return the raw project + issues so the caller can present the problems.
  if (!issues.some((i) => i.code === "PK_REQUIRED")) {
    ProjectSchema.parse(project);
  }

  return { project, relationships, issues };
}
