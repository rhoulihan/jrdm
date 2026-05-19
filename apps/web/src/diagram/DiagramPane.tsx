// @tested-by: apps/web/src/diagram/DiagramPane.test.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useJrdmStore } from "../state/store";
import { projectToGraph } from "./projectToGraph";
import { EntityNode } from "./EntityNode";
import { RelationshipEdge } from "./RelationshipEdge";
import { ContextMenu } from "./ContextMenu";
import { canMapToDocument } from "./canMapToDocument";
import { canCreateNewView } from "./canCreateNewView";
import type { GraphNode, GraphEdge } from "./projectToGraph";

interface MenuState {
  open: boolean;
  x: number;
  y: number;
  entityName: string | null;
}

const CLOSED_MENU: MenuState = { open: false, x: 0, y: 0, entityName: null };

export function DiagramPane() {
  const project = useJrdmStore((s) => s.project);
  const relationships = useJrdmStore((s) => s.relationships);
  const importToken = useJrdmStore((s) => s.importToken);
  const editingView = useJrdmStore((s) => s.editingView);
  const hiddenEntities = useJrdmStore((s) => s.hiddenEntities);
  const openMapping = useJrdmStore((s) => s.openMapping);
  const selectEntity = useJrdmStore((s) => s.selectEntity);
  const setInspectorOpen = useJrdmStore((s) => s.setInspectorOpen);
  const hideEntity = useJrdmStore((s) => s.hideEntity);
  const showAllEntities = useJrdmStore((s) => s.showAllEntities);

  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<GraphEdge>([]);
  const [menu, setMenu] = useState<MenuState>(CLOSED_MENU);

  // Re-seed layout ONLY when a new import arrives.
  // Keyed on importToken — a monotonically-incrementing counter bumped atomically
  // with every setImport call. Guarantees that importing schema B after schema A
  // always re-seeds even when name and entity count are identical.
  // User drags are preserved across unrelated re-renders (token unchanged).
  useEffect(() => {
    if (!project) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const graph = projectToGraph(project, relationships);
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [importToken]); // intentionally keyed on importToken only — setNodes/setEdges are stable

  const openMenuFor = useCallback((entityName: string, x: number, y: number) => {
    setMenu({ open: true, x, y, entityName });
  }, []);

  const closeMenu = useCallback(() => setMenu(CLOSED_MENU), []);

  // Resolve entity name from node id (node id = "<schema>.<name>")
  const entityNameFromNodeId = useCallback((nodeId: string): string => {
    // Node id format: "<schema>.<entityName>"
    const parts = nodeId.split(".");
    return parts.slice(1).join("."); // support schemas with dots (unlikely but safe)
  }, []);

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: { id: string }) => {
      e.preventDefault();
      const name = entityNameFromNodeId(node.id);
      setMenu({ open: true, x: e.clientX, y: e.clientY, entityName: name });
    },
    [entityNameFromNodeId],
  );

  // Build context menu items for the current entity
  const menuItems = useMemo(() => {
    if (!menu.entityName) return [];
    const name = menu.entityName;
    const nodeId = project?.entities.find((e) => e.name === name)
      ? `${project.entities.find((e) => e.name === name)!.schema}.${name}`
      : name;
    const canMap = canMapToDocument(editingView);
    const canNew = canCreateNewView(editingView);

    return [
      {
        label: "Map to document…",
        onSelect: () => openMapping(name),
        disabled: !canMap,
        ...(canMap ? {} : { title: "Create a root view first (New duality view from this table)" }),
      },
      {
        label: "New duality view from this table",
        onSelect: () => openMapping(name),
        disabled: !canNew,
        ...(!canNew ? { title: "Reset the current view to start a new one" } : {}),
      },
      {
        label: "Inspect table",
        onSelect: () => {
          selectEntity(nodeId);
          setInspectorOpen(true);
        },
      },
      {
        label: "Hide from canvas",
        onSelect: () => hideEntity(name),
      },
    ];
  }, [
    menu.entityName,
    editingView,
    openMapping,
    selectEntity,
    setInspectorOpen,
    hideEntity,
    project,
  ]);

  // Filter hidden entities from the rendered nodes
  const visibleNodes = useMemo(
    () => nodes.filter((n) => !hiddenEntities.includes(entityNameFromNodeId(n.id))),
    [nodes, hiddenEntities, entityNameFromNodeId],
  );

  // Pass onOpenMenu into EntityNode via the _onOpenMenu prop (consumed by mock in tests;
  // in production, pass via nodeTypes wrapper that closes over openMenuFor)
  const nodeTypes = useMemo(
    () => ({
      entity: (props: Parameters<typeof EntityNode>[0]) =>
        EntityNode({ ...props, onOpenMenu: openMenuFor }),
    }),
    [openMenuFor],
  );
  const edgeTypes = useMemo(() => ({ relationship: RelationshipEdge }), []);

  if (!project) {
    return (
      <div data-testid="diagram-empty" className="h-full grid place-items-center text-jrdm-muted">
        Import an Oracle schema to see the ERD.
      </div>
    );
  }

  return (
    <div data-testid="diagram-canvas" className="h-full relative">
      <ReactFlow
        nodes={visibleNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeContextMenu={handleNodeContextMenu}
        // _onOpenMenu is a test-seam: the mock reads it to wire the ⋯ button
        {...({ _onOpenMenu: openMenuFor } as object)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
      >
        <Background />
        <Controls />
      </ReactFlow>

      {hiddenEntities.length > 0 && (
        <button
          type="button"
          data-testid="show-hidden"
          onClick={showAllEntities}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 text-sm bg-surface-alt border border-jrdm-border rounded shadow hover:bg-surface"
        >
          Show hidden ({hiddenEntities.length})
        </button>
      )}

      <ContextMenu open={menu.open} x={menu.x} y={menu.y} items={menuItems} onClose={closeMenu} />
    </div>
  );
}
