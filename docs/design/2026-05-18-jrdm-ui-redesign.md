# JRDM UI/UX Redesign — Design Document (for review before implementation)

> **Status:** PROPOSAL — not yet implemented. Review the personas, principles, layout, and the SVG wireframes in `./wireframes/`, then we refine and build phase-by-phase with the usual TDD + CI-gated discipline.

## 0. Why we're stepping back

We've been fixing the UI bit-by-bit (draggable nodes, layout, a Connect button) but the _shell_ is wrong: a fixed left sidebar form, a right inspector rail, an ERD/Design **mode toggle**, and a bottom strip — all competing for space, none resizable. Symptoms: the Connect button overflows out of view; you must select an entity in "ERD mode" then switch to "Design mode" to use it; neither canvas can be zoomed/maximized. These are not bugs to patch — they're a layout that fights the core task.

**The core task** of JRDM is one continuous gesture: _look at a relational schema and drag pieces of it into a JSON document shape, watch the duality-view DDL appear, deploy and test it._ The UI must make that gesture frictionless and give it the whole screen.

## 1. User personas

| Persona                                                                           | Who                                                                                   | Goals                                                                                  | What they need from the UI                                                                                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Dana — Data Architect** (primary)                                               | Designs relational schemas + the document APIs over them. SQL-fluent, thinks in ERDs. | See the whole schema and relationships; shape several duality views; iterate fast.     | Maximum ERD canvas, relationship clarity, fast keyboard/drag, ability to grow the ERD side. Hates mode-switching and tiny panes. |
| **Arjun — Backend/API Developer**                                                 | Owns the app; knows the JSON the app needs, less SQL-fluent.                          | Assemble the document shape by dragging; see generated SQL/GraphQL; deploy and sample. | A big, clear document tree; live DDL; drag from ERD without context loss; one-click deploy/test.                                 |
| **Priya — DBA / Oracle SME** (also: the demo driver — this is shown to customers) | Connects to live Oracle, deploys, demonstrates ETag round-trip & conflict.            | Manage connections, deploy to a sandbox, sample/edit, show conflict, tear down.        | Connection & deploy as deliberate modal flows (not always-on clutter); a clean, beautiful, demo-able screen; obvious status.     |
| **Sam — Evaluator / Learner**                                                     | Exploring duality views for the first time.                                           | Understand the relational↔document mapping.                                            | A layout that visually pairs ERD ↔ document side-by-side; gentle empty states; discoverable menus.                               |

**Design implication:** Dana and Arjun live in the canvas all day → the canvas is sacred, chrome is minimal and on-demand. Priya needs connection/deploy to be _deliberate, contained_ actions (modals) and the whole thing to look polished. Sam needs the ERD↔document pairing to be _visually obvious_ → side-by-side, always both visible.

## 2. Design principles

1. **The canvas is the product.** Everything that isn't the ERD or the document tree is collapsible, on-demand, or a modal. No permanent forms eating width.
2. **One workspace, no modes.** ERD and document are _always both visible, side by side_. You never "switch to design view." You drag straight across the divider.
3. **Direct manipulation.** Drag an entity → it becomes (or seeds) the document root or a nested node. Drag a column → it becomes a bound scalar. The drop target is always right there.
4. **Reveal complexity on demand.** Connection, import, deploy, inspector, DDL, issues — all reachable from a menu/toolbar, surfaced as modals or collapsible docks, never resident clutter.
5. **Resizable everything.** A draggable splitter the user owns; either side can be maximized; both panes zoom and scroll independently.
6. **Beautiful, Oracle-Redwood-aligned.** Use the existing tokens (accent `#C74634`, surface `#FAF9F7`, alt `#FFFFFF`, border `#E3E0DB`, text `#1A1A1A`, muted `#6B6B6B`; relationship edges 1:1 `#2E7D32`, 1:N `#1565C0`). Generous whitespace, calm neutrals, red used sparingly for primary actions and live/danger state. Demo-grade polish.

## 3. Information architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│ MENU BAR     Project ▾  Connection ▾  Deploy ▾  View ▾  Help ▾       │  ← commands
├────────────────────────────────────────────────────────────────────┤
│ TOOLBAR  [● Connected: SALES@FREEPDB1]  [Connect…] [Import…]         │  ← status + quick actions
│          [Deploy…]   |  ⊟ fit  ⊞ zoom  ⟲ relayout  |  ◧ split reset  │
├──────────────────────────────┬─────────────────────────────────────┤
│  ERD CANVAS                   ║   DOCUMENT CANVAS                    │
│  (React Flow, zoom/pan,       ║   (duality view tree, pan/zoom,      │
│   minimap, draggable          ║    drop target, root + nested)       │
│   entities; each column       ║                                     │
│   is a drag handle)         ◀─║─▶  ← draggable splitter (the "bar")  │
│                               ║   the user moves to maximize a side  │
├──────────────────────────────┴─────────────────────────────────────┤
│ BOTTOM DOCK (collapsible, tabbed)   DDL · Issues · Deploy Results    │  ← on-demand
├────────────────────────────────────────────────────────────────────┤
│ STATUS BAR   project: orders_api · view: orders_dv · zoom 80% · ✓ ok │
└────────────────────────────────────────────────────────────────────┘
        Inspector = right-edge slide-over drawer, opens on selection
        Connection / Import / Deploy / Sample-Edit = modals
```

## 4. The split-screen workspace (the heart of it)

- **Left = ERD canvas.** React Flow (already gives zoom/pan/fit). Add a **minimap**, fit/zoom controls, the v0.4.2 hybrid grid layout. **Entities** show a header + column list; the **entity header is a drag source** ("use as root" / add as nested) and **each column row is a drag source** (`application/x-jrdm-column`, already implemented). Selecting an entity/column opens the Inspector drawer.
- **Splitter = the bar.** A full-height grab strip between the panes:
  - Drag left/right to reallocate width; live ratio.
  - **Collapse chevrons** (◀ / ▶) snap a side to a thin rail; click again to restore.
  - **Double-click = reset to 50/50.**
  - Keyboard accessible: `role="separator"`, `aria-valuenow`, ←/→ to nudge, `Home`/`End` to maximize.
  - Ratio persisted (store + localStorage) so it survives reloads.
- **Right = document canvas.** The duality-view tree (root table → scalar/nested fields). It is a **pan/zoom viewport**: scrollable, wheel/⌘-zoom, a small zoom control + "fit" overlay, so large documents stay navigable. It is always a drop target — drop a column to add a bound scalar, drop an entity to add a nested object/array, drop onto a nested node to nest deeper (the v0.3b.1 rules, now reachable without a mode switch).
- **No ERD/Design mode.** Remove the toggle entirely. The two canvases coexist; the divider replaces the mode switch.

## 5. Chrome: menus, toolbar, modals, dock, drawer

- **Menu bar** (commands & config, keyboardable):
  - **Project**: New, Open, Save, Recent, Export YAML.
  - **Connection**: Connect…, Import Schema…, Disconnect. (Opens the **Connect modal** — fixes the hidden-button problem permanently: connection lives in a roomy modal, not a squeezed sidebar.)
  - **Deploy**: Deploy View…, Sample Documents, Edit Document…, Simulate Conflict, Tear Down Sandbox.
  - **View**: Zoom In/Out/Fit (per focused canvas), Relayout ERD, Toggle Bottom Dock, Toggle Inspector, Reset Split, Theme.
  - **Help**: Docs, About, Keyboard shortcuts.
- **Toolbar** (always visible, one row): live **connection status chip** (grey=disconnected, green=connected, red=error), primary actions `Connect…` `Import…` `Deploy…`, canvas controls (fit / zoom / relayout), split reset. This is where Priya's demo actions live, one click away, but not consuming canvas.
- **Connect modal**: the v0.4.2 flow done right — connection fields, a **Connect** button that lists schemas, a **schema dropdown**, then **Import**. Roomy, never clipped. (Replaces `ConnectionForm` sidebar.)
- **Deploy modal**: connection target + Deploy → result; tabs for Sample / Edit / Conflict (the existing `preview/*` components, re-housed).
- **Bottom dock** (collapsible, tabbed): **DDL** (SQL ⇄ GraphQL toggle — `DdlPane`/`SyntaxToggle`), **Issues** (`IssuesPanel`), **Deploy Results** (`ResultsPane`). Collapsed by default to a thin tab strip → maximal canvas; one click to peek.
- **Inspector drawer**: a right-edge slide-over (over the document canvas, doesn't shrink it) that appears when a field/entity/view is selected — houses `FieldInspector`/`ViewInspector` (e.g. nested `link.from/to`, permissions, ETag policy). Pinnable for power users; auto-dismiss for demo clarity.

## 6. Interaction model — the drag, end to end

1. Open **Connect modal** → enter creds → **Connect** → pick schema → **Import**. Modal closes; ERD fills the left canvas (auto-laid-out grid/dagre, draggable).
2. Drag an **entity** from the ERD across the splitter onto the empty document canvas → it becomes the **document root** (`orders_dv` seeded). Or right-click an entity → "New duality view from…".
3. Drag **columns** from any entity onto the document tree → bound scalar fields. Drag a **related entity** onto a node → nested object/array (link auto-suggested from FK; editable in the Inspector drawer).
4. **Bottom dock → DDL** shows live SQL/GraphQL as you build.
5. **Deploy modal** → deploy to the sandbox → **Sample** → **Edit** a field → watch the ETag round-trip → **Simulate Conflict** (ORA-42699 banner) → **Tear Down**.
6. The splitter lets Dana widen the ERD while mapping, then widen the document side while structuring — without ever losing the other side.

## 7. Component migration map (old → new)

| Today                                                                       | Becomes                                                                                                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx` (mode toggle, fixed sidebar/rail/footer)                          | `AppShell` = `MenuBar` + `Toolbar` + `SplitPane(ERD, DocCanvas)` + `BottomDock` + `StatusBar` + `InspectorDrawer`. **No mode state.** |
| `connection/ConnectionForm` (sidebar)                                       | `ConnectModal` (roomy; v0.4.2 Connect→schema→Import flow)                                                                             |
| `diagram/DiagramPane`                                                       | Left pane content; add minimap + entity-header drag source; keep v0.4.2 layout/draggable fixes                                        |
| `document/DocumentTree` + `FieldNode`                                       | Right pane content wrapped in `PanZoomViewport` (scroll + zoom)                                                                       |
| `ddl/DdlPane` + `SyntaxToggle`, `issues/IssuesPanel`, `preview/ResultsPane` | `BottomDock` tabs                                                                                                                     |
| `inspector/*` (`ContextInspector`/`Field`/`View`)                           | `InspectorDrawer` (slide-over)                                                                                                        |
| `preview/DeployDialog`/`DocumentEditModal`/`ConflictBanner`/`PreviewPanel`  | `DeployModal` flow (re-housed, mostly intact)                                                                                         |
| store `mode`, mode actions                                                  | removed; add `splitRatio`, `dockOpen`, `dockTab`, `inspectorOpen`, `inspectorPinned`                                                  |

Most leaf components (EntityNode, FieldNode, DdlPane internals, preview/*) **survive largely intact** — this is a*shell\* redesign, not a rewrite. Risk is concentrated in `AppShell`/`SplitPane`/`PanZoomViewport`, all new and unit-testable.

## 8. Wireframes (in `./wireframes/`, open in a browser)

| File                      | Shows                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `01-main-layout.svg`      | The full workspace: menu bar, toolbar, 50/50 ERD ╎ document split, collapsed bottom dock, status bar                |
| `02-erd-maximized.svg`    | Splitter dragged right — ERD takes the screen (Dana mapping a big schema)                                           |
| `03-doc-maximized.svg`    | Splitter dragged left — document tree takes the screen (Arjun structuring)                                          |
| `04-connect-modal.svg`    | The Connect/Import modal: fields → Connect → schema dropdown → Import                                               |
| `05-drag-interaction.svg` | Dragging a column from an ERD entity across the splitter into the document tree (ghost + drop indicator + live DDL) |
| `06-deploy-modal.svg`     | Deploy → Sample → Edit → Conflict modal flow                                                                        |

## 9. Phased implementation plan (each phase = TDD + CI-gated PRs + milestone review, no feature regressions)

- **Phase 0 — Shell skeleton.** `AppShell` + `SplitPane` (draggable, collapse, reset, persisted ratio, a11y) + `StatusBar`. Remove `mode`. ERD and DocumentTree mounted side-by-side. Bottom dock + inspector as stubs. _No feature loss; existing components rendered in new slots._ Heaviest review focus (new layout primitives).
- **Phase 1 — Connect modal.** Move `ConnectionForm`→`ConnectModal` behind the Connection menu/toolbar; delete the sidebar. (Permanently fixes the hidden Connect button.)
- **Phase 2 — Bottom dock.** DDL / Issues / Deploy-Results as collapsible tabs.
- **Phase 3 — Inspector drawer.** Slide-over housing the existing inspectors.
- **Phase 4 — Document pan/zoom viewport.** Wrap the tree; wheel/⌘ zoom + scroll + fit; preserve the v0.3b.1 keyboard tree a11y.
- **Phase 5 — Unified drag + polish.** Entity-header drag → root/nested; FK-suggested links; empty states; theme/Redwood polish pass; full keyboard map; axe-clean.

Each phase ships working software, is independently reviewable, and ends with the independent milestone-review gate verifying reachability + no regression on the exact main HEAD.

## 10. Open decisions for review (let's lock these before Phase 0)

1. **Document-canvas zoom mechanism** — (A, recommended) lightweight CSS-transform pan/zoom viewport wrapping the existing accessible `DocumentTree` (keeps the v0.3b.1 ARIA tree + keyboard nav, minimal risk); vs (B) re-render the document as a React Flow graph (visually consistent zoom/minimap with the ERD, but loses the native tree semantics and is a bigger change).
2. **Inspector** — (A, recommended) right-edge slide-over drawer (zero canvas cost, demo-clean); vs (B) a docked, collapsible right column (always-available for power users, costs width).
3. **DDL/Issues placement** — (A, recommended) collapsible **bottom** dock (full-width DDL is nice for long statements); vs (B) a tab inside the right region.
4. **Splitter orientation option** — vertical split only, or also offer a horizontal (ERD top / document bottom) toggle for ultrawide vs portrait? (Recommend: ship vertical; add the toggle in Phase 5 if wanted.)

I'll fold your answers into a build plan (`docs/plans/…-v0.5-ui-shell.md`) and we execute Phase 0 first.
