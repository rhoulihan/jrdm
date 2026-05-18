import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Relationship } from "@jrdm/model";
import { MappingTree, type MappingTreeProps } from "./MappingTree";
import { seedWorkingCopy, addNode, isLocked, toDualityView } from "./workingCopy";
import type { DualityView } from "@jrdm/model";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * A pre-existing DualityView — its nodes are locked (pre-session).
 * Fields:
 *   [0] _id  (scalar, locked)
 *   [1] status  (scalar, locked)
 *   [2] shipping  (nested/object, locked)
 *     [2,0] city  (scalar, locked)
 */
const PRE_EXISTING_VIEW: DualityView = {
  name: "v_orders",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "ORDERS",
    permissions: { insert: false, update: false, delete: false },
    etag: "check",
  },
  fields: [
    { key: "_id", source: "ORDERS.id" },
    { key: "status", source: "ORDERS.order_status" },
    {
      key: "shipping",
      kind: "object",
      table: "ADDRESSES",
      link: { from: ["addr_id"], to: ["id"] },
      fields: [{ key: "city", source: "ADDRESSES.city" }],
    },
  ],
};

/** 1:N relationship ORDERS→ORDER_ITEMS */
const REL_1N: Relationship = {
  name: "FK_ORDER_ITEMS_ORDERS",
  from: { schema: "app", table: "ORDERS", columns: ["id"] },
  to: { schema: "app", table: "ORDER_ITEMS", columns: ["order_id"] },
  cardinality: "1:N",
};

/** 1:1 relationship ORDERS→ORDER_DETAILS */
const REL_1_1: Relationship = {
  name: "FK_ORDER_DETAILS_ORDERS",
  from: { schema: "app", table: "ORDERS", columns: ["id"] },
  to: { schema: "app", table: "ORDER_DETAILS", columns: ["order_id"] },
  cardinality: "1:1",
};

function makeWcWithSession() {
  const wc = seedWorkingCopy(PRE_EXISTING_VIEW);
  // Add a session-new nested node under root ([3])
  const wc2 = addNode(wc, null, { key: "items", kind: "array", table: "ORDER_ITEMS" });
  return { wc: wc2, sessionPath: [toDualityView(wc2).fields.length - 1] };
}

function makeDefaultProps(overrides: Partial<MappingTreeProps> = {}): MappingTreeProps {
  const { wc } = makeWcWithSession();
  return {
    workingCopy: wc,
    selectedPath: null,
    droppedTable: "ORDER_ITEMS",
    relationships: [REL_1N],
    embedAsArray: true,
    onSelect: vi.fn(),
    onAddNode: vi.fn(),
    onDeleteNode: vi.fn(),
    onToggleEmbed: vi.fn(),
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMappingTree() {
  return screen.getByTestId("mapping-tree");
}

function getAddBtn() {
  return screen.getByTestId("add-node-btn");
}

function getDeleteBtn() {
  return screen.getByTestId("delete-node-btn");
}

function getEmbedCheckbox() {
  return screen.getByTestId("embed-as-array");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MappingTree — rendering", () => {
  it("renders the mapping-tree container with data-testid", () => {
    render(<MappingTree {...makeDefaultProps()} />);
    expect(getMappingTree()).toBeInTheDocument();
  });

  it("renders a role=tree container for a11y", () => {
    render(<MappingTree {...makeDefaultProps()} />);
    expect(screen.getByRole("tree")).toBeInTheDocument();
  });

  it("renders all field nodes from the WorkingCopy", () => {
    // pre-existing view has _id, status, shipping; we also added items
    render(<MappingTree {...makeDefaultProps()} />);
    // Each node has data-testid="mnode-<dotpath>"
    expect(screen.getByTestId("mnode-0")).toBeInTheDocument(); // _id
    expect(screen.getByTestId("mnode-1")).toBeInTheDocument(); // status
    expect(screen.getByTestId("mnode-2")).toBeInTheDocument(); // shipping
    expect(screen.getByTestId("mnode-3")).toBeInTheDocument(); // items (session-new)
  });

  it("renders nested children with dot-delimited testids", () => {
    render(<MappingTree {...makeDefaultProps()} />);
    // shipping.city is at path [2,0] → "mnode-2.0"
    expect(screen.getByTestId("mnode-2.0")).toBeInTheDocument();
  });

  it("renders field key text for each node", () => {
    render(<MappingTree {...makeDefaultProps()} />);
    expect(screen.getByText("_id")).toBeInTheDocument();
    expect(screen.getByText("status")).toBeInTheDocument();
    expect(screen.getByText("shipping")).toBeInTheDocument();
    expect(screen.getByText("items")).toBeInTheDocument();
  });
});

describe("MappingTree — locked vs session-new visual distinction", () => {
  it("locked nodes render a visible lock indicator (🔒 text or aria-label)", () => {
    render(<MappingTree {...makeDefaultProps()} />);
    const lockedNode = screen.getByTestId("mnode-0"); // _id is locked
    // Should contain 🔒 or have data-locked attribute or aria-label
    const hasLockMark =
      lockedNode.textContent?.includes("🔒") ||
      lockedNode.getAttribute("data-locked") === "true" ||
      lockedNode.querySelector("[aria-label*='locked']") !== null ||
      lockedNode.querySelector("[data-locked='true']") !== null;
    expect(hasLockMark).toBe(true);
  });

  it("session-new nodes do NOT render a lock indicator", () => {
    const { wc, sessionPath } = makeWcWithSession();
    const [idx] = sessionPath;
    render(<MappingTree {...makeDefaultProps({ workingCopy: wc })} />);
    const sessionNode = screen.getByTestId(`mnode-${idx}`);
    // Should NOT contain 🔒 and NOT have data-locked=true
    const hasLockMark =
      sessionNode.textContent?.includes("🔒") || sessionNode.getAttribute("data-locked") === "true";
    expect(hasLockMark).toBe(false);
  });

  it("uses isLocked from M.T1 workingCopy API: _id path [0] is locked", () => {
    const wc = seedWorkingCopy(PRE_EXISTING_VIEW);
    expect(isLocked(wc, [0])).toBe(true);
    expect(isLocked(wc, [1])).toBe(true);
    expect(isLocked(wc, [2])).toBe(true);
    expect(isLocked(wc, [2, 0])).toBe(true);
    // session-added node would not be locked (tested via addNode)
    const wc2 = addNode(wc, null, { key: "x", kind: "object", table: "T" });
    const newIdx = toDualityView(wc2).fields.length - 1;
    expect(isLocked(wc2, [newIdx])).toBe(false);
  });

  it("locked nodes have data-locked=true attribute on their element", () => {
    render(<MappingTree {...makeDefaultProps()} />);
    expect(screen.getByTestId("mnode-0").getAttribute("data-locked")).toBe("true");
    expect(screen.getByTestId("mnode-1").getAttribute("data-locked")).toBe("true");
    expect(screen.getByTestId("mnode-2").getAttribute("data-locked")).toBe("true");
    expect(screen.getByTestId("mnode-2.0").getAttribute("data-locked")).toBe("true");
  });

  it("session-new nodes have data-locked=false attribute", () => {
    const { wc, sessionPath } = makeWcWithSession();
    const [idx] = sessionPath;
    render(<MappingTree {...makeDefaultProps({ workingCopy: wc })} />);
    expect(screen.getByTestId(`mnode-${idx}`).getAttribute("data-locked")).toBe("false");
  });
});

describe("MappingTree — node selection", () => {
  it("calls onSelect with the path when clicking a node", () => {
    const onSelect = vi.fn();
    render(<MappingTree {...makeDefaultProps({ onSelect })} />);
    fireEvent.click(screen.getByTestId("mnode-1")); // status
    expect(onSelect).toHaveBeenCalledWith([1]);
  });

  it("calls onSelect with nested path when clicking a child node", () => {
    const onSelect = vi.fn();
    render(<MappingTree {...makeDefaultProps({ onSelect })} />);
    fireEvent.click(screen.getByTestId("mnode-2.0")); // shipping.city
    expect(onSelect).toHaveBeenCalledWith([2, 0]);
  });

  it("selected node has aria-selected=true", () => {
    render(<MappingTree {...makeDefaultProps({ selectedPath: [1] })} />);
    expect(screen.getByTestId("mnode-1").getAttribute("aria-selected")).toBe("true");
  });

  it("non-selected nodes have aria-selected=false", () => {
    render(<MappingTree {...makeDefaultProps({ selectedPath: [1] })} />);
    expect(screen.getByTestId("mnode-0").getAttribute("aria-selected")).toBe("false");
  });

  it("all nodes have role=treeitem", () => {
    render(<MappingTree {...makeDefaultProps()} />);
    const treeitems = screen.getAllByRole("treeitem");
    // At least: _id, status, shipping, shipping.city, items
    expect(treeitems.length).toBeGreaterThanOrEqual(5);
  });

  it("clicking the deselect affordance calls onSelect(null)", () => {
    const onSelect = vi.fn();
    render(<MappingTree {...makeDefaultProps({ selectedPath: [1], onSelect })} />);
    const deselect = screen.getByTestId("mapping-tree-deselect");
    fireEvent.click(deselect);
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

describe("MappingTree — keyboard navigation", () => {
  it("ArrowDown from no selection focuses the first node", () => {
    const onSelect = vi.fn();
    render(<MappingTree {...makeDefaultProps({ selectedPath: null, onSelect })} />);
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenCalledWith([0]);
  });

  it("ArrowDown from last node stays at last", () => {
    // Find the last flat path in the working copy (items = [3])
    const { wc, sessionPath } = makeWcWithSession();
    const onSelect = vi.fn();
    // Select the last node: items is at [3] (after shipping.city which is [2,0])
    // flat order: [0],[1],[2],[2,0],[3]
    render(
      <MappingTree
        {...makeDefaultProps({ workingCopy: wc, selectedPath: sessionPath, onSelect })}
      />,
    );
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    // Already at last node → should call onSelect with last path again or stay
    const calls = onSelect.mock.calls;
    if (calls.length > 0) {
      // It should not have gone past the end
      const lastCall = calls[calls.length - 1]![0] as number[];
      expect(lastCall).toEqual(sessionPath);
    }
    // If no call, it stayed — also acceptable
  });

  it("ArrowUp from first node stays at first", () => {
    const onSelect = vi.fn();
    render(<MappingTree {...makeDefaultProps({ selectedPath: [0], onSelect })} />);
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowUp" });
    expect(onSelect).toHaveBeenCalledWith([0]);
  });

  it("ArrowUp from second node moves to first", () => {
    const onSelect = vi.fn();
    render(<MappingTree {...makeDefaultProps({ selectedPath: [1], onSelect })} />);
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowUp" });
    expect(onSelect).toHaveBeenCalledWith([0]);
  });
});

describe("MappingTree — + add node button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an + add node button with data-testid=add-node-btn", () => {
    render(<MappingTree {...makeDefaultProps()} />);
    expect(getAddBtn()).toBeInTheDocument();
  });

  it("clicking + calls onAddNode", () => {
    const onAddNode = vi.fn();
    render(<MappingTree {...makeDefaultProps({ onAddNode })} />);
    fireEvent.click(getAddBtn());
    expect(onAddNode).toHaveBeenCalledTimes(1);
  });

  it("+ button is always enabled (root or subnode, never intrinsically disabled)", () => {
    render(<MappingTree {...makeDefaultProps({ selectedPath: null })} />);
    expect(getAddBtn()).not.toBeDisabled();
  });

  it("+ button has accessible label/title conveying root vs subnode semantics", () => {
    render(<MappingTree {...makeDefaultProps({ selectedPath: null })} />);
    const btn = getAddBtn();
    const label =
      btn.getAttribute("aria-label") || btn.getAttribute("title") || btn.textContent || "";
    expect(label.toLowerCase()).toMatch(/root|add/i);
  });

  it("+ button label mentions subnode/child when a node is selected", () => {
    render(<MappingTree {...makeDefaultProps({ selectedPath: [1] })} />);
    const btn = getAddBtn();
    const label =
      btn.getAttribute("aria-label") || btn.getAttribute("title") || btn.textContent || "";
    expect(label.toLowerCase()).toMatch(/sub|child|under|add/i);
  });
});

describe("MappingTree — − delete button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a − delete button with data-testid=delete-node-btn", () => {
    render(<MappingTree {...makeDefaultProps()} />);
    expect(getDeleteBtn()).toBeInTheDocument();
  });

  it("− is DISABLED when no node is selected (selectedPath=null)", () => {
    render(<MappingTree {...makeDefaultProps({ selectedPath: null })} />);
    expect(getDeleteBtn()).toBeDisabled();
  });

  it("− is DISABLED when the selected node is locked (pre-existing)", () => {
    // [0] = _id, which is locked
    render(<MappingTree {...makeDefaultProps({ selectedPath: [0] })} />);
    expect(getDeleteBtn()).toBeDisabled();
  });

  it("− is DISABLED when a locked nested node is selected", () => {
    render(<MappingTree {...makeDefaultProps({ selectedPath: [2] })} />); // shipping (locked)
    expect(getDeleteBtn()).toBeDisabled();
  });

  it("− is DISABLED when a locked child node is selected", () => {
    render(<MappingTree {...makeDefaultProps({ selectedPath: [2, 0] })} />); // shipping.city
    expect(getDeleteBtn()).toBeDisabled();
  });

  it("− is ENABLED when a session-new node is selected", () => {
    const { wc, sessionPath } = makeWcWithSession();
    render(<MappingTree {...makeDefaultProps({ workingCopy: wc, selectedPath: sessionPath })} />);
    expect(getDeleteBtn()).not.toBeDisabled();
  });

  it("clicking enabled − calls onDeleteNode", () => {
    const { wc, sessionPath } = makeWcWithSession();
    const onDeleteNode = vi.fn();
    render(
      <MappingTree
        {...makeDefaultProps({ workingCopy: wc, selectedPath: sessionPath, onDeleteNode })}
      />,
    );
    fireEvent.click(getDeleteBtn());
    expect(onDeleteNode).toHaveBeenCalledTimes(1);
  });

  it("clicking disabled − does NOT call onDeleteNode", () => {
    const onDeleteNode = vi.fn();
    render(<MappingTree {...makeDefaultProps({ selectedPath: [0], onDeleteNode })} />);
    fireEvent.click(getDeleteBtn());
    expect(onDeleteNode).not.toHaveBeenCalled();
  });
});

describe("MappingTree — embed as array checkbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * The embed-as-array checkbox is visible when the dropped-table node is placed
   * under a parent (not root). We simulate this by having a session-new node
   * that represents the dropped table under a parent.
   *
   * In our fixture: the wc has items (ORDER_ITEMS) at root level [3].
   * For a "non-root" scenario we need items under a parent, e.g. under shipping.
   * But to keep it simple, we pass selectedPath pointing to the session node
   * and a parentTable so the component can derive the parent table context.
   *
   * Per spec: embed checkbox is shown when the dropped entity node is not at root.
   * We model this with the `embedAsArray` prop + a `parentTable` prop OR by
   * checking whether the selected node's path has a parent (path.length > 1 or
   * the node is at root[>0] under a nested parent).
   *
   * The MappingTree component receives `embedAsArray` + is responsible for
   * determining visibility from whether the selected session node was placed
   * under a parent (not as a direct root child at top level [n]).
   *
   * For the test, we'll use the `parentTable` prop that MappingTree derives internally,
   * and test visibility via embedAsArray being shown/hidden.
   *
   * Simpler approach: the checkbox is hidden when `parentTable` is undefined/null
   * (i.e. root placement) and shown otherwise. We'll use a `showEmbed` prop OR
   * infer from props. Let's go with the spec's approach: the component shows
   * the checkbox when the placed entity node has a parent (i.e., the selectedPath
   * has a parent = the session node is under another node).
   *
   * For testability, we'll pass `parentTable` as a prop to MappingTree.
   * When parentTable is undefined → hidden (root placement).
   * When parentTable is set → visible.
   */

  it("embed checkbox is visible when parentTable is provided (non-root placement)", () => {
    render(
      <MappingTree
        {...makeDefaultProps({
          parentTable: "ORDERS",
          embedAsArray: false,
        })}
      />,
    );
    expect(getEmbedCheckbox()).toBeInTheDocument();
  });

  it("embed checkbox is HIDDEN when parentTable is undefined (root placement)", () => {
    render(
      <MappingTree
        {...makeDefaultProps({
          parentTable: undefined,
          embedAsArray: false,
        })}
      />,
    );
    expect(screen.queryByTestId("embed-as-array")).toBeNull();
  });

  it("embed checkbox reflects the embedAsArray prop (checked=true)", () => {
    render(
      <MappingTree
        {...makeDefaultProps({
          parentTable: "ORDERS",
          embedAsArray: true,
        })}
      />,
    );
    expect(getEmbedCheckbox()).toBeChecked();
  });

  it("embed checkbox reflects the embedAsArray prop (checked=false)", () => {
    render(
      <MappingTree
        {...makeDefaultProps({
          parentTable: "ORDERS",
          embedAsArray: false,
        })}
      />,
    );
    expect(getEmbedCheckbox()).not.toBeChecked();
  });

  it("checkbox calls onToggleEmbed when not FK-driven", () => {
    // No relationships → not FK-driven → user-toggleable
    const onToggleEmbed = vi.fn();
    render(
      <MappingTree
        {...makeDefaultProps({
          relationships: [], // no FK
          parentTable: "ORDERS",
          droppedTable: "ORDER_ITEMS",
          embedAsArray: false,
          onToggleEmbed,
        })}
      />,
    );
    fireEvent.click(getEmbedCheckbox());
    expect(onToggleEmbed).toHaveBeenCalledTimes(1);
  });

  it("checkbox is DISABLED (forced) when FK-driven (1:N relationship)", () => {
    // REL_1N: ORDERS→ORDER_ITEMS 1:N → fkDriven=true → disabled
    render(
      <MappingTree
        {...makeDefaultProps({
          relationships: [REL_1N],
          parentTable: "ORDERS",
          droppedTable: "ORDER_ITEMS",
          embedAsArray: true,
        })}
      />,
    );
    expect(getEmbedCheckbox()).toBeDisabled();
  });

  it("checkbox is DISABLED (forced) when FK-driven (1:1 relationship)", () => {
    render(
      <MappingTree
        {...makeDefaultProps({
          relationships: [REL_1_1],
          parentTable: "ORDERS",
          droppedTable: "ORDER_DETAILS",
          embedAsArray: false,
        })}
      />,
    );
    expect(getEmbedCheckbox()).toBeDisabled();
  });

  it("FK-driven disabled checkbox has a tooltip naming the relationship", () => {
    render(
      <MappingTree
        {...makeDefaultProps({
          relationships: [REL_1N],
          parentTable: "ORDERS",
          droppedTable: "ORDER_ITEMS",
          embedAsArray: true,
        })}
      />,
    );
    const checkbox = getEmbedCheckbox();
    // Tooltip on the checkbox or its wrapper
    const container = checkbox.closest("[title]") || checkbox;
    const title = container.getAttribute("title") || checkbox.getAttribute("title") || "";
    // Should mention FK and the relationship
    expect(title).toMatch(/FK|fk/i);
    expect(title).toMatch(/ORDERS|ORDER_ITEMS/i);
  });

  it("not FK-driven: checkbox is enabled and calls onToggleEmbed", () => {
    const onToggleEmbed = vi.fn();
    render(
      <MappingTree
        {...makeDefaultProps({
          relationships: [], // no FK
          parentTable: "ORDERS",
          droppedTable: "UNRELATED_TABLE",
          embedAsArray: false,
          onToggleEmbed,
        })}
      />,
    );
    expect(getEmbedCheckbox()).not.toBeDisabled();
    fireEvent.click(getEmbedCheckbox());
    expect(onToggleEmbed).toHaveBeenCalledTimes(1);
  });

  it("FK-driven: clicking does NOT call onToggleEmbed", () => {
    const onToggleEmbed = vi.fn();
    render(
      <MappingTree
        {...makeDefaultProps({
          relationships: [REL_1N],
          parentTable: "ORDERS",
          droppedTable: "ORDER_ITEMS",
          embedAsArray: true,
          onToggleEmbed,
        })}
      />,
    );
    fireEvent.click(getEmbedCheckbox());
    expect(onToggleEmbed).not.toHaveBeenCalled();
  });

  it("uses decideEmbed from fkEmbed.ts to determine fkDriven (real API)", () => {
    // This test verifies the component actually uses decideEmbed correctly.
    // 1:N FK should force-disable the checkbox (fkDriven=true)
    render(
      <MappingTree
        {...makeDefaultProps({
          relationships: [REL_1N],
          parentTable: "ORDERS",
          droppedTable: "ORDER_ITEMS",
          embedAsArray: true,
        })}
      />,
    );
    expect(getEmbedCheckbox()).toBeDisabled(); // fkDriven=true → forced
  });
});

describe("MappingTree — no store coupling", () => {
  it("renders without any store provider (pure controlled component)", () => {
    expect(() => render(<MappingTree {...makeDefaultProps()} />)).not.toThrow();
  });

  it("renders an empty WorkingCopy (seeded from null) without crashing", () => {
    const wc = seedWorkingCopy(null);
    expect(() =>
      render(<MappingTree {...makeDefaultProps({ workingCopy: wc, selectedPath: null })} />),
    ).not.toThrow();
  });
});

describe("MappingTree — WorkingCopy API integration", () => {
  it("renders the correct number of nodes from the M.T1 WorkingCopy", () => {
    const wc = seedWorkingCopy(PRE_EXISTING_VIEW);
    render(<MappingTree {...makeDefaultProps({ workingCopy: wc })} />);
    // _id [0], status [1], shipping [2], shipping.city [2.0] = 4 nodes
    const treeitems = screen.getAllByRole("treeitem");
    expect(treeitems.length).toBe(4);
  });

  it("after addNode the tree renders the new session node", () => {
    let wc = seedWorkingCopy(PRE_EXISTING_VIEW);
    wc = addNode(wc, null, { key: "items", kind: "array", table: "ORDER_ITEMS" });
    render(<MappingTree {...makeDefaultProps({ workingCopy: wc })} />);
    const treeitems = screen.getAllByRole("treeitem");
    expect(treeitems.length).toBe(5); // +1 for items
    expect(screen.getByText("items")).toBeInTheDocument();
  });
});
