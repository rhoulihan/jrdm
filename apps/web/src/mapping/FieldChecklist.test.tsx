import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { FieldChecklist, type FieldChecklistProps } from "./FieldChecklist";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COLUMNS = [
  { name: "id", type: "NUMBER" },
  { name: "order_id", type: "NUMBER" },
  { name: "sku", type: "VARCHAR2" },
  { name: "qty", type: "NUMBER" },
  { name: "price", type: "NUMBER" },
];

function makeProps(overrides: Partial<FieldChecklistProps> = {}): FieldChecklistProps {
  return {
    columns: COLUMNS,
    selected: new Set(["id", "order_id", "qty"]),
    selectAll: false,
    onToggleColumn: vi.fn(),
    onToggleSelectAll: vi.fn(),
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFieldList() {
  return screen.getByTestId("field-list");
}

function getSelectAll() {
  return screen.getByTestId("select-all");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FieldChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Basic rendering ─────────────────────────────────────────────────────────

  it("renders the field-list container", () => {
    render(<FieldChecklist {...makeProps()} />);
    expect(getFieldList()).toBeInTheDocument();
  });

  it("renders a row for every column", () => {
    render(<FieldChecklist {...makeProps()} />);
    for (const col of COLUMNS) {
      expect(screen.getByTestId(`field-${col.name}`)).toBeInTheDocument();
    }
  });

  it("renders each column's name as visible text", () => {
    render(<FieldChecklist {...makeProps()} />);
    for (const col of COLUMNS) {
      expect(screen.getByText(col.name)).toBeInTheDocument();
    }
  });

  it("renders each column's type as visible text", () => {
    render(<FieldChecklist {...makeProps()} />);
    // 3 NUMBER columns → 3 occurrences; let's just check there are NUMBER and VARCHAR2
    const numbers = screen.getAllByText("NUMBER");
    expect(numbers.length).toBeGreaterThan(0);
    expect(screen.getByText("VARCHAR2")).toBeInTheDocument();
  });

  it("renders the select-all control above the list", () => {
    render(<FieldChecklist {...makeProps()} />);
    const selectAll = getSelectAll();
    const fieldList = getFieldList();
    // Select-all should come before the list in the DOM
    expect(
      selectAll.compareDocumentPosition(fieldList) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // ── Select-All checkbox ─────────────────────────────────────────────────────

  it("renders the select-all checkbox with data-testid=select-all", () => {
    render(<FieldChecklist {...makeProps()} />);
    expect(getSelectAll()).toBeInTheDocument();
  });

  it("select-all checkbox has an accessible label", () => {
    render(<FieldChecklist {...makeProps()} />);
    // Should be findable by role+name, meaning it has an associated label
    const checkbox = screen.getByRole("checkbox", { name: /select all/i });
    expect(checkbox).toBeInTheDocument();
  });

  it("select-all is unchecked when selectAll=false", () => {
    render(<FieldChecklist {...makeProps({ selectAll: false })} />);
    expect(getSelectAll()).not.toBeChecked();
  });

  it("select-all is checked when selectAll=true", () => {
    render(<FieldChecklist {...makeProps({ selectAll: true })} />);
    expect(getSelectAll()).toBeChecked();
  });

  it("clicking select-all calls onToggleSelectAll", () => {
    const onToggleSelectAll = vi.fn();
    render(<FieldChecklist {...makeProps({ onToggleSelectAll })} />);
    fireEvent.click(getSelectAll());
    expect(onToggleSelectAll).toHaveBeenCalledTimes(1);
  });

  it("clicking select-all does NOT call onToggleColumn", () => {
    const onToggleColumn = vi.fn();
    render(<FieldChecklist {...makeProps({ onToggleColumn })} />);
    fireEvent.click(getSelectAll());
    expect(onToggleColumn).not.toHaveBeenCalled();
  });

  // ── Individual column checkboxes (selectAll=false) ──────────────────────────

  it("checked columns reflect the selected set when selectAll=false", () => {
    const selected = new Set(["id", "qty"]);
    render(<FieldChecklist {...makeProps({ selected, selectAll: false })} />);

    expect(screen.getByTestId("field-id")).toBeChecked();
    expect(screen.getByTestId("field-qty")).toBeChecked();
    expect(screen.getByTestId("field-sku")).not.toBeChecked();
    expect(screen.getByTestId("field-price")).not.toBeChecked();
  });

  it("unchecked column calls onToggleColumn(name) on click", () => {
    const onToggleColumn = vi.fn();
    render(
      <FieldChecklist {...makeProps({ onToggleColumn, selectAll: false, selected: new Set() })} />,
    );
    fireEvent.click(screen.getByTestId("field-sku"));
    expect(onToggleColumn).toHaveBeenCalledWith("sku");
  });

  it("checked column calls onToggleColumn(name) on click", () => {
    const onToggleColumn = vi.fn();
    render(
      <FieldChecklist
        {...makeProps({ onToggleColumn, selectAll: false, selected: new Set(["id"]) })}
      />,
    );
    fireEvent.click(screen.getByTestId("field-id"));
    expect(onToggleColumn).toHaveBeenCalledWith("id");
  });

  it("each row checkbox has an accessible label containing the column name", () => {
    render(<FieldChecklist {...makeProps()} />);
    for (const col of COLUMNS) {
      // Use word-boundary match so "id" doesn't match "order_id"
      expect(
        screen.getByRole("checkbox", { name: new RegExp(`(^|\\s)${col.name}(\\s|$)`, "i") }),
      ).toBeInTheDocument();
    }
  });

  // ── Select-All=true: list is disabled and grayed out ───────────────────────

  it("when selectAll=true all column inputs are disabled", () => {
    render(<FieldChecklist {...makeProps({ selectAll: true })} />);
    const list = getFieldList();
    const checkboxes = within(list).getAllByRole("checkbox");
    for (const cb of checkboxes) {
      expect(cb).toBeDisabled();
    }
  });

  it("when selectAll=true all column checkboxes appear checked", () => {
    render(<FieldChecklist {...makeProps({ selectAll: true, selected: new Set() })} />);
    const list = getFieldList();
    const checkboxes = within(list).getAllByRole("checkbox");
    for (const cb of checkboxes) {
      expect(cb).toBeChecked();
    }
  });

  it("when selectAll=true the list has a visually-muted class", () => {
    render(<FieldChecklist {...makeProps({ selectAll: true })} />);
    const list = getFieldList();
    // Should carry opacity or pointer-events-none when grayed
    const classList = Array.from(list.classList);
    const hasMutedStyle = classList.some(
      (c) => c.includes("opacity") || c.includes("pointer-events"),
    );
    expect(hasMutedStyle).toBe(true);
  });

  it("when selectAll=false the list is NOT disabled/grayed (no pointer-events-none)", () => {
    render(<FieldChecklist {...makeProps({ selectAll: false })} />);
    const list = getFieldList();
    expect(list.classList.contains("pointer-events-none")).toBe(false);
  });

  it("when selectAll=true clicking a column row does NOT call onToggleColumn", () => {
    const onToggleColumn = vi.fn();
    render(
      <FieldChecklist {...makeProps({ onToggleColumn, selectAll: true, selected: new Set() })} />,
    );
    // disabled inputs don't fire change events
    fireEvent.click(screen.getByTestId("field-sku"));
    expect(onToggleColumn).not.toHaveBeenCalled();
  });

  // ── Scrollable list ─────────────────────────────────────────────────────────

  it("field-list has overflow-y-auto class (scrollable)", () => {
    render(<FieldChecklist {...makeProps()} />);
    expect(getFieldList().classList.contains("overflow-y-auto")).toBe(true);
  });

  it("field-list has a max-h-* class (bounded height)", () => {
    render(<FieldChecklist {...makeProps()} />);
    const classList = Array.from(getFieldList().classList);
    const hasMaxH = classList.some((c) => c.startsWith("max-h-"));
    expect(hasMaxH).toBe(true);
  });

  // ── No store coupling ────────────────────────────────────────────────────────

  it("renders without any store provider (pure/controlled)", () => {
    expect(() => render(<FieldChecklist {...makeProps()} />)).not.toThrow();
  });

  it("renders an empty column list without crashing", () => {
    expect(() =>
      render(<FieldChecklist {...makeProps({ columns: [], selected: new Set() })} />),
    ).not.toThrow();
  });
});
