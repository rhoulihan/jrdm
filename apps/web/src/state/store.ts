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

type DdlSyntax = "sql" | "graphql";
type SplitCollapsed = "left" | "right" | null;
type DockTab = "ddl" | "issues" | "deploy";

interface JrdmState {
  connection: ConnectionDraft;
  project: DraftProject | null;
  relationships: Relationship[];
  issues: ImportPayload["issues"];
  importToken: number;
  selectedEntity: string | null;
  editingView: DualityView | null;
  selectedFieldPath: number[] | null;
  ddlSyntax: DdlSyntax;
  // layout slice (cross-project user preference — NOT cleared by reset())
  splitRatio: number;
  splitCollapsed: SplitCollapsed;
  dockOpen: boolean;
  dockTab: DockTab;
  inspectorOpen: boolean;
  inspectorPinned: boolean;
  connectModalOpen: boolean;
  // preview slice
  deployState: "idle" | "deploying" | "deployed" | "error";
  deployMessage: string | null;
  sampleDocs: unknown[];
  selectedDocId: string | number | null;
  conflict: { message: string } | null;
  // schema slice
  schemas: string[];
  selectedSchema: string | null;
  schemaLoad: "idle" | "loading" | "error";
  // mapping slice (ephemeral — Map-to-Document modal; not persisted)
  mapping: { open: boolean; table: string | null };
  // hidden-entities slice (ephemeral view-state; not persisted; cleared by reset())
  hiddenEntities: string[];
  setConnection: (patch: Partial<ConnectionDraft>) => void;
  setImport: (p: ImportPayload) => void;
  selectEntity: (name: string | null) => void;
  setSplitRatio: (r: number) => void;
  setSplitCollapsed: (c: SplitCollapsed) => void;
  toggleDock: () => void;
  setDockTab: (t: DockTab) => void;
  setInspectorOpen: (open: boolean) => void;
  toggleInspectorPin: () => void;
  setConnectModalOpen: (open: boolean) => void;
  startNewView: (table: string) => void;
  setEditingView: (v: DualityView | null) => void;
  selectField: (path: number[] | null) => void;
  setDdlSyntax: (s: DdlSyntax) => void;
  setDeployState: (s: JrdmState["deployState"], message?: string | null) => void;
  setSampleDocs: (d: unknown[]) => void;
  selectDoc: (id: string | number | null) => void;
  setConflict: (c: { message: string } | null) => void;
  setSchemas: (schemas: string[]) => void;
  selectSchema: (schema: string | null) => void;
  setSchemaLoad: (state: "idle" | "loading" | "error") => void;
  openMapping: (table: string) => void;
  closeMapping: () => void;
  hideEntity: (name: string) => void;
  showEntity: (name: string) => void;
  showAllEntities: () => void;
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
  editingView: null as DualityView | null,
  selectedFieldPath: null as number[] | null,
  ddlSyntax: "sql" as DdlSyntax,
};

// --- Layout persistence (cross-project user preference) ---
const LAYOUT_STORAGE_KEY = "jrdm.layout.v1";

interface PersistedLayout {
  splitRatio: number;
  splitCollapsed: SplitCollapsed;
  dockOpen: boolean;
  dockTab: DockTab;
}

const LAYOUT_FALLBACK: PersistedLayout = {
  splitRatio: 0.5,
  splitCollapsed: null,
  dockOpen: false,
  dockTab: "ddl",
};

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readPersistedLayout(): PersistedLayout {
  const ls = safeLocalStorage();
  if (!ls) return { ...LAYOUT_FALLBACK };
  try {
    const raw = ls.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return { ...LAYOUT_FALLBACK };
    const parsed = JSON.parse(raw) as Partial<PersistedLayout>;
    const ratio =
      typeof parsed.splitRatio === "number" && parsed.splitRatio > 0 && parsed.splitRatio < 1
        ? parsed.splitRatio
        : LAYOUT_FALLBACK.splitRatio;
    const collapsed =
      parsed.splitCollapsed === "left" || parsed.splitCollapsed === "right"
        ? parsed.splitCollapsed
        : null;
    const dockTab =
      parsed.dockTab === "ddl" || parsed.dockTab === "issues" || parsed.dockTab === "deploy"
        ? parsed.dockTab
        : LAYOUT_FALLBACK.dockTab;
    return {
      splitRatio: ratio,
      splitCollapsed: collapsed,
      dockOpen: typeof parsed.dockOpen === "boolean" ? parsed.dockOpen : LAYOUT_FALLBACK.dockOpen,
      dockTab,
    };
  } catch {
    return { ...LAYOUT_FALLBACK };
  }
}

function writePersistedLayout(layout: PersistedLayout): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* ignore quota / serialization failures */
  }
}

const PREVIEW_DEFAULTS = {
  deployState: "idle" as const,
  deployMessage: null as string | null,
  sampleDocs: [] as unknown[],
  selectedDocId: null as string | number | null,
  conflict: null as { message: string } | null,
} as const;

const SCHEMA_DEFAULTS = {
  schemas: [] as string[],
  selectedSchema: null as string | null,
  schemaLoad: "idle" as const,
};

const MAPPING_DEFAULTS = {
  mapping: { open: false, table: null as string | null },
} as const;

const HIDDEN_ENTITIES_DEFAULTS = {
  hiddenEntities: [] as string[],
};

const initialLayout = readPersistedLayout();

export const useJrdmStore = create<JrdmState>((set, get) => ({
  connection: { ...EMPTY_CONNECTION },
  project: null,
  relationships: [],
  issues: [],
  importToken: 0,
  selectedEntity: null,
  ...AUTHORING_DEFAULTS,
  ...PREVIEW_DEFAULTS,
  ...SCHEMA_DEFAULTS,
  mapping: { ...MAPPING_DEFAULTS.mapping },
  ...HIDDEN_ENTITIES_DEFAULTS,
  // layout slice — persisted keys seeded from localStorage
  splitRatio: initialLayout.splitRatio,
  splitCollapsed: initialLayout.splitCollapsed,
  dockOpen: initialLayout.dockOpen,
  dockTab: initialLayout.dockTab,
  inspectorOpen: false,
  inspectorPinned: false,
  connectModalOpen: false,
  setConnection: (patch) => set((s) => ({ connection: { ...s.connection, ...patch } })),
  setImport: (p) =>
    set((s) => ({
      project: p.project,
      relationships: p.relationships,
      issues: p.issues,
      importToken: s.importToken + 1,
    })),
  selectEntity: (name) => set({ selectedEntity: name }),
  setSplitRatio: (r) => {
    set({ splitRatio: r });
    const s = get();
    writePersistedLayout({
      splitRatio: s.splitRatio,
      splitCollapsed: s.splitCollapsed,
      dockOpen: s.dockOpen,
      dockTab: s.dockTab,
    });
  },
  setSplitCollapsed: (c) => {
    set({ splitCollapsed: c });
    const s = get();
    writePersistedLayout({
      splitRatio: s.splitRatio,
      splitCollapsed: s.splitCollapsed,
      dockOpen: s.dockOpen,
      dockTab: s.dockTab,
    });
  },
  toggleDock: () => {
    set((s) => ({ dockOpen: !s.dockOpen }));
    const s = get();
    writePersistedLayout({
      splitRatio: s.splitRatio,
      splitCollapsed: s.splitCollapsed,
      dockOpen: s.dockOpen,
      dockTab: s.dockTab,
    });
  },
  setDockTab: (t) => {
    set({ dockTab: t });
    const s = get();
    writePersistedLayout({
      splitRatio: s.splitRatio,
      splitCollapsed: s.splitCollapsed,
      dockOpen: s.dockOpen,
      dockTab: s.dockTab,
    });
  },
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  toggleInspectorPin: () => set((s) => ({ inspectorPinned: !s.inspectorPinned })),
  setConnectModalOpen: (open) => set({ connectModalOpen: open }),
  startNewView: (table) =>
    set({
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
  setDeployState: (s, message = null) => set({ deployState: s, deployMessage: message ?? null }),
  setSampleDocs: (d) => set({ sampleDocs: d }),
  selectDoc: (id) => set({ selectedDocId: id }),
  setConflict: (c) => set({ conflict: c }),
  setSchemas: (schemas) => set({ schemas }),
  selectSchema: (schema) => set({ selectedSchema: schema }),
  setSchemaLoad: (state) => set({ schemaLoad: state }),
  openMapping: (table) => set({ mapping: { open: true, table } }),
  closeMapping: () => set({ mapping: { open: false, table: null } }),
  hideEntity: (name) =>
    set((s) => ({
      hiddenEntities: s.hiddenEntities.includes(name)
        ? s.hiddenEntities
        : [...s.hiddenEntities, name],
    })),
  showEntity: (name) =>
    set((s) => ({ hiddenEntities: s.hiddenEntities.filter((n) => n !== name) })),
  showAllEntities: () => set({ hiddenEntities: [] }),
  reset: () =>
    set({
      connection: { ...EMPTY_CONNECTION },
      project: null,
      relationships: [],
      issues: [],
      importToken: 0,
      selectedEntity: null,
      ...AUTHORING_DEFAULTS,
      ...PREVIEW_DEFAULTS,
      ...SCHEMA_DEFAULTS,
      mapping: { ...MAPPING_DEFAULTS.mapping },
      ...HIDDEN_ENTITIES_DEFAULTS,
    }),
}));
