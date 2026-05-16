import { create } from "zustand";
import type { DraftProject, Relationship } from "@jrdm/model";

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

interface JrdmState {
  connection: ConnectionDraft;
  project: DraftProject | null;
  relationships: Relationship[];
  issues: ImportPayload["issues"];
  selectedEntity: string | null;
  setConnection: (patch: Partial<ConnectionDraft>) => void;
  setImport: (p: ImportPayload) => void;
  selectEntity: (name: string | null) => void;
  reset: () => void;
}

const EMPTY_CONNECTION: ConnectionDraft = {
  user: "",
  password: "",
  connectString: "",
  schemaOwner: "",
  projectName: "imported",
};

export const useJrdmStore = create<JrdmState>((set) => ({
  connection: { ...EMPTY_CONNECTION },
  project: null,
  relationships: [],
  issues: [],
  selectedEntity: null,
  setConnection: (patch) => set((s) => ({ connection: { ...s.connection, ...patch } })),
  setImport: (p) => set({ project: p.project, relationships: p.relationships, issues: p.issues }),
  selectEntity: (name) => set({ selectedEntity: name }),
  reset: () =>
    set({
      connection: { ...EMPTY_CONNECTION },
      project: null,
      relationships: [],
      issues: [],
      selectedEntity: null,
    }),
}));
