import { describe, it, expect } from "vitest";
import { parseEntity, stringifyEntity, parseView, stringifyView } from "../serde";
import type { Entity, DualityView } from "../schemas";

const entity: Entity = {
  name: "orders",
  schema: "app",
  columns: [
    { name: "order_id", type: "NUMBER", nullable: false },
    { name: "order_datetime", type: "TIMESTAMP", nullable: false },
  ],
  primaryKey: ["order_id"],
};

const view: DualityView = {
  name: "orders_dv",
  schema: "app",
  createMode: "orReplace",
  root: {
    table: "orders",
    permissions: { insert: true, update: true, delete: true },
    etag: "check",
  },
  fields: [
    { key: "_id", source: "orders.order_id" },
    { key: "orderTime", source: "orders.order_datetime" },
  ],
};

describe("entity serde", () => {
  it("round-trips a valid entity", () => {
    const yaml = stringifyEntity(entity);
    expect(parseEntity(yaml)).toEqual(entity);
  });

  it("throws on malformed YAML", () => {
    expect(() => parseEntity("this: is: not: yaml")).toThrow();
  });

  it("throws on schema-invalid YAML", () => {
    expect(() => parseEntity("name: x\nschema: y\ncolumns: []\nprimaryKey: []")).toThrow();
  });
});

describe("view serde", () => {
  it("round-trips a valid view", () => {
    const yaml = stringifyView(view);
    expect(parseView(yaml)).toEqual(view);
  });
});

import { parseProject, stringifyProject } from "../serde";
import type { Project } from "../schemas";

describe("project serde", () => {
  const project: Project = {
    name: "orders",
    version: "0.1.0",
    entities: [
      {
        name: "orders",
        schema: "app",
        columns: [{ name: "order_id", type: "NUMBER", nullable: false }],
        primaryKey: ["order_id"],
      },
    ],
    views: [],
  };

  it("round-trips a project through YAML", () => {
    expect(parseProject(stringifyProject(project))).toEqual(project);
  });

  it("throws on schema-invalid project YAML", () => {
    expect(() => parseProject("name: x")).toThrow();
  });
});
