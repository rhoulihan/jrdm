import { describe, it, expect } from "vitest";
import {
  validateEntity,
  validateRelationships,
  validateProject,
  validateDualityView,
} from "../rules";
import type { Entity, Project, DualityView } from "@jrdm/model";

const customers: Entity = {
  name: "customers",
  schema: "app",
  columns: [{ name: "customer_id", type: "NUMBER", nullable: false }],
  primaryKey: ["customer_id"],
};

const orders: Entity = {
  name: "orders",
  schema: "app",
  columns: [
    { name: "order_id", type: "NUMBER", nullable: false },
    { name: "customer_id", type: "NUMBER", nullable: false },
  ],
  primaryKey: ["order_id"],
  foreignKeys: [
    {
      name: "fk_orders_customer",
      columns: ["customer_id"],
      references: { schema: "app", table: "customers", columns: ["customer_id"] },
    },
  ],
};

describe("validateEntity", () => {
  it("returns no issues for a valid entity", () => {
    expect(validateEntity(customers)).toEqual([]);
  });

  it("flags an entity with no primary key", () => {
    const e: Entity = { ...customers, primaryKey: [] };
    expect(validateEntity(e)).toContainEqual(
      expect.objectContaining({ code: "PK_REQUIRED", severity: "error" }),
    );
  });

  it("flags a duplicate column name", () => {
    const e: Entity = {
      ...customers,
      columns: [
        { name: "customer_id", type: "NUMBER", nullable: false },
        { name: "customer_id", type: "VARCHAR2", nullable: true },
      ],
    };
    expect(validateEntity(e)).toContainEqual(
      expect.objectContaining({ code: "DUPLICATE_COLUMN", severity: "error" }),
    );
  });
});

describe("validateRelationships", () => {
  it("returns no issues when every FK references an in-project table+columns", () => {
    expect(validateRelationships([customers, orders])).toEqual([]);
  });

  it("flags an FK whose referenced table is absent from the project", () => {
    const issues = validateRelationships([orders]); // customers missing
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "FK_DANGLING_TABLE", severity: "error" }),
    );
  });

  it("flags an FK whose referenced columns are not the PK/UK of the target", () => {
    const badTarget: Entity = {
      ...customers,
      primaryKey: ["customer_id"],
      columns: [
        { name: "customer_id", type: "NUMBER", nullable: false },
        { name: "other", type: "NUMBER", nullable: false },
      ],
    };
    const childRefsNonKey: Entity = {
      ...orders,
      foreignKeys: [
        {
          name: "fk_bad",
          columns: ["customer_id"],
          references: { schema: "app", table: "customers", columns: ["other"] },
        },
      ],
    };
    const issues = validateRelationships([badTarget, childRefsNonKey]);
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "FK_TARGET_NOT_KEY", severity: "error" }),
    );
  });
});

describe("validateProject", () => {
  it("aggregates entity + relationship issues with entity context in the path", () => {
    const project: Project = {
      name: "p",
      version: "0.1.0",
      entities: [orders], // customers missing → dangling FK
      views: [],
    };
    const issues = validateProject(project);
    expect(issues.some((i) => i.code === "FK_DANGLING_TABLE")).toBe(true);
  });

  it("includes entity issues with path prefixed by entity name", () => {
    const noPk: Entity = { ...customers, primaryKey: [] };
    const project: Project = { name: "p", version: "0.1.0", entities: [noPk], views: [] };
    const issues = validateProject(project);
    const pkIssue = issues.find((i) => i.code === "PK_REQUIRED");
    expect(pkIssue).toBeDefined();
    expect(pkIssue?.path[0]).toBe("entities");
    expect(pkIssue?.path[1]).toBe("customers");
  });

  it("returns [] for a fully consistent project", () => {
    const project: Project = {
      name: "p",
      version: "0.1.0",
      entities: [customers, orders],
      views: [],
    };
    expect(validateProject(project)).toEqual([]);
  });
});

const okView: DualityView = {
  name: "t_dv",
  schema: "app",
  createMode: "create",
  root: {
    table: "team",
    permissions: { insert: false, update: false, delete: false },
    etag: "check",
  },
  fields: [
    { key: "_id", source: "team.team_id" },
    {
      key: "driver",
      kind: "array",
      table: "driver",
      etag: "check",
      link: ["team_id"],
      fields: [{ key: "name", source: "driver.name" }],
    },
  ],
};

describe("validateDualityView", () => {
  it("returns [] for a well-formed view", () => {
    expect(validateDualityView(okView)).toEqual([]);
  });

  it("flags a nested field with no link", () => {
    const v: DualityView = {
      ...okView,
      fields: [
        { key: "_id", source: "team.team_id" },
        {
          key: "driver",
          kind: "array",
          table: "driver",
          etag: "check",
          fields: [{ key: "n", source: "driver.name" }],
        },
      ],
    };
    expect(validateDualityView(v)).toContainEqual(
      expect.objectContaining({ code: "NESTED_LINK_REQUIRED", severity: "error" }),
    );
  });

  it("flags when the first field is not _id", () => {
    const v: DualityView = {
      ...okView,
      fields: [
        { key: "name", source: "team.name" },
        { key: "_id", source: "team.team_id" },
      ],
    };
    expect(validateDualityView(v)).toContainEqual(
      expect.objectContaining({ code: "ID_FIRST_REQUIRED", severity: "error" }),
    );
  });

  it("flags a nested field whose table equals its parent table", () => {
    const v: DualityView = {
      ...okView,
      fields: [
        { key: "_id", source: "team.team_id" },
        {
          key: "self",
          kind: "object",
          table: "team",
          etag: "check",
          link: ["team_id"],
          fields: [{ key: "n", source: "team.name" }],
        },
      ],
    };
    expect(validateDualityView(v)).toContainEqual(
      expect.objectContaining({ code: "NESTED_SELF_TABLE", severity: "warning" }),
    );
  });
});
