import { create } from "zustand";
import type { DraftProject, Relationship, DualityView } from "@jrdm/model";

export interface ConnectionDraft {
  user: string;
  password: string;
  connectString: string;
  schemaOwner: string;
  projectName: string;
}

export interface ImportPayload {
  project: DraftProject;
  relationships: Relationship[];
  issues: { code: string; severity: string; message: string; path: (string | number)[] }[];
}

type Mode = "erd" | "design";
type DdlSyntax = "sql" | "graphql";

interface JrdmState {
  connection: ConnectionDraft;
  project: DraftProject | null;
  relationships: Relationship[];
  issues: ImportPayload["issues"];
  selectedEntity: string | null;
  mode: Mode;
  editingView: DualityView | null;
  selectedFieldPath: number[] | null;
  ddlSyntax: DdlSyntax;
  setConnection: (patch: Partial<ConnectionDraft>) => void;
  setImport: (p: ImportPayload) => void;
  selectEntity: (name: string | null) => void;
  setMode: (m: Mode) => void;
  startNewView: (table: string) => void;
  setEditingView: (v: DualityView | null) => void;
  selectField: (path: number[] | null) => void;
  setDdlSyntax: (s: DdlSyntax) => void;
  reset: () => void;
}

const EMPTY_CONNECTION: ConnectionDraft = {
  user: "",
  password: "",
  connectString: "",
  schemaOwner: "",
  projectName: "imported",
};

const AUTHORING_DEFAULTS = {
  mode: "erd" as Mode,
  editingView: null as DualityView | null,
  selectedFieldPath: null as number[] | null,
  ddlSyntax: "sql" as DdlSyntax,
};

export const useJrdmStore = create<JrdmState>((set) => ({
  connection: { ...EMPTY_CONNECTION },
  project: null,
  relationships: [],
  issues: [],
  selectedEntity: null,
  ...AUTHORING_DEFAULTS,
  setConnection: (patch) => set((s) => ({ connection: { ...s.connection, ...patch } })),
  setImport: (p) => set({ project: p.project, relationships: p.relationships, issues: p.issues }),
  selectEntity: (name) => set({ selectedEntity: name }),
  setMode: (m) => set({ mode: m }),
  startNewView: (table) =>
    set({
      mode: "design",
      editingView: {
        name: `${table}_dv`,
        schema: "app",
        createMode: "orReplace",
        root: {
          table,
          permissions: { insert: false, update: false, delete: false },
          etag: "check",
        },
        fields: [{ key: "_id", source: `${table}.id` }],
      },
    }),
  setEditingView: (v) => set({ editingView: v }),
  selectField: (path) => set({ selectedFieldPath: path }),
  setDdlSyntax: (s) => set({ ddlSyntax: s }),
  reset: () =>
    set({
      connection: { ...EMPTY_CONNECTION },
      project: null,
      relationships: [],
      issues: [],
      selectedEntity: null,
      ...AUTHORING_DEFAULTS,
    }),
}));
