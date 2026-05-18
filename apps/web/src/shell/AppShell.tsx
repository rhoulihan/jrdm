// @tested-by: apps/web/src/shell/AppShell.test.tsx
import { useMemo, useEffect, useRef } from "react";
import { useJrdmStore } from "../state/store";
import { useImport } from "../import/useImport";
import { ConnectionForm } from "../connection/ConnectionForm";
import { DiagramPane } from "../diagram/DiagramPane";
import { DocumentTree } from "../document/DocumentTree";
import { DdlPane } from "../ddl/DdlPane";
import { IssuesPanel } from "../issues/IssuesPanel";
import { PreviewPanel } from "../preview/PreviewPanel";
import { ContextInspector } from "../inspector/ContextInspector";
import { MapToDocumentModal } from "../mapping/MapToDocumentModal";
import { MenuBar, type MenuBarItem } from "./MenuBar";
import { Toolbar, type ConnectionStatus } from "./Toolbar";
import { SplitPane } from "./SplitPane";
import { BottomDock, type DockTab as DockTabModel } from "./BottomDock";
import { InspectorDrawer } from "./InspectorDrawer";
import { StatusBar } from "./StatusBar";
import { Modal } from "./Modal";

export function AppShell() {
  const { run, busy, error } = useImport();

  const project = useJrdmStore((s) => s.project);
  const editingView = useJrdmStore((s) => s.editingView);
  const issues = useJrdmStore((s) => s.issues);
  const schemaLoad = useJrdmStore((s) => s.schemaLoad);
  const selectedEntity = useJrdmStore((s) => s.selectedEntity);
  const startNewView = useJrdmStore((s) => s.startNewView);

  const splitRatio = useJrdmStore((s) => s.splitRatio);
  const splitCollapsed = useJrdmStore((s) => s.splitCollapsed);
  const setSplitRatio = useJrdmStore((s) => s.setSplitRatio);
  const setSplitCollapsed = useJrdmStore((s) => s.setSplitCollapsed);

  const dockOpen = useJrdmStore((s) => s.dockOpen);
  const dockTab = useJrdmStore((s) => s.dockTab);
  const toggleDock = useJrdmStore((s) => s.toggleDock);
  const setDockTab = useJrdmStore((s) => s.setDockTab);

  const inspectorOpen = useJrdmStore((s) => s.inspectorOpen);
  const inspectorPinned = useJrdmStore((s) => s.inspectorPinned);
  const setInspectorOpen = useJrdmStore((s) => s.setInspectorOpen);
  const toggleInspectorPin = useJrdmStore((s) => s.toggleInspectorPin);

  const connectModalOpen = useJrdmStore((s) => s.connectModalOpen);
  const setConnectModalOpen = useJrdmStore((s) => s.setConnectModalOpen);

  const selectedFieldPath = useJrdmStore((s) => s.selectedFieldPath);

  // Preserve "selection → inspector": opening a selection surfaces the drawer
  // (the redesigned right-rail UX is a later phase; this keeps zero regression).
  const prevSelection = useRef<string | null>(null);
  useEffect(() => {
    const key =
      selectedEntity ?? (selectedFieldPath ? `field:${selectedFieldPath.join(".")}` : null);
    if (key && key !== prevSelection.current) {
      setInspectorOpen(true);
    }
    prevSelection.current = key;
  }, [selectedEntity, selectedFieldPath, setInspectorOpen]);

  const connectionStatus: ConnectionStatus =
    schemaLoad === "error" ? "error" : project ? "connected" : "disconnected";

  const openConnect = () => setConnectModalOpen(true);
  const openDeploy = () => {
    setDockTab("deploy");
    if (!dockOpen) toggleDock();
  };
  const newViewFromSelection = () => {
    if (!selectedEntity) return;
    startNewView(selectedEntity.split(".").pop() ?? selectedEntity);
  };

  const dockTabs: DockTabModel[] = useMemo(
    () => [
      { id: "ddl", label: "DDL", node: <DdlPane /> },
      { id: "issues", label: "Issues", node: <IssuesPanel /> },
      { id: "deploy", label: "Deploy", node: <PreviewPanel /> },
    ],
    [],
  );

  const menuItems: MenuBarItem[] = useMemo(
    () => [
      {
        id: "connection",
        label: "Connection",
        children: [{ id: "connect", label: "Connect…", onSelect: openConnect }],
      },
      {
        id: "view",
        label: "View",
        children: [
          {
            id: "new-view",
            label: "New view from selection",
            onSelect: newViewFromSelection,
          },
          {
            id: "toggle-dock",
            label: "Toggle bottom dock",
            onSelect: toggleDock,
          },
          {
            id: "toggle-inspector",
            label: "Toggle inspector",
            onSelect: () => setInspectorOpen(!inspectorOpen),
          },
          {
            id: "reset-split",
            label: "Reset split",
            onSelect: () => setSplitRatio(0.5),
          },
        ],
      },
      {
        id: "deploy",
        label: "Deploy",
        children: [{ id: "open-deploy", label: "Deploy view…", onSelect: openDeploy }],
      },
    ],
    [selectedEntity, inspectorOpen, dockOpen],
  );

  return (
    <div className="h-full flex flex-col bg-surface text-jrdm-text">
      <header className="flex items-center gap-4 px-3 py-1 border-b border-jrdm-border bg-surface-alt">
        <h1 className="font-semibold text-accent text-sm whitespace-nowrap">
          JRDM — JSON Relational Duality Mapper
        </h1>
      </header>

      <MenuBar items={menuItems} />

      <Toolbar
        connection={connectionStatus}
        onConnect={openConnect}
        onImport={openConnect}
        onDeploy={openDeploy}
        onResetSplit={() => setSplitRatio(0.5)}
        onFit={() => setSplitCollapsed(null)}
      />

      {selectedEntity && (
        <div className="px-3 py-1 border-b border-jrdm-border bg-surface-alt">
          <button
            type="button"
            data-testid="new-view-btn"
            onClick={newViewFromSelection}
            className="text-xs underline text-accent"
          >
            Design view from "{selectedEntity}"
          </button>
        </div>
      )}

      {error && (
        <div
          data-testid="error-banner"
          className="bg-[color:var(--danger,#B00020)] text-white px-4 py-2 text-sm"
        >
          Import failed: {error}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <SplitPane
              left={<DiagramPane />}
              right={<DocumentTree />}
              ratio={splitRatio}
              onRatioChange={setSplitRatio}
              collapsed={splitCollapsed}
              onCollapsedChange={setSplitCollapsed}
            />
          </div>
          <BottomDock
            open={dockOpen}
            tab={dockTab}
            onToggle={toggleDock}
            onTab={(id) => setDockTab(id as "ddl" | "issues" | "deploy")}
            tabs={dockTabs}
          />
        </div>

        <InspectorDrawer
          open={inspectorOpen}
          pinned={inspectorPinned}
          onClose={() => setInspectorOpen(false)}
          onTogglePin={toggleInspectorPin}
        >
          <ContextInspector />
        </InspectorDrawer>
      </div>

      <StatusBar
        {...(project ? { project: project.name } : {})}
        {...(editingView ? { view: editingView.name } : {})}
        erdZoom={1}
        docZoom={1}
        valid={issues.every((i) => i.severity !== "error")}
      />

      <Modal
        open={connectModalOpen}
        title="Connect to Oracle"
        onClose={() => setConnectModalOpen(false)}
      >
        <ConnectionForm
          onSubmit={(req) => {
            void run(req);
            setConnectModalOpen(false);
          }}
          busy={busy}
        />
      </Modal>

      {/* Map Table to Document modal — self-gates on mapping.open in the store */}
      <MapToDocumentModal />
    </div>
  );
}
