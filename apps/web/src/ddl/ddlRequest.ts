import type { DualityView } from "@jrdm/model";

export interface DdlRequestBody {
  view: DualityView;
  syntax: "sql" | "graphql";
}

export function buildDdlRequestBody(view: DualityView, syntax: "sql" | "graphql"): DdlRequestBody {
  return { view, syntax };
}
