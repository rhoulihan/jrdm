import yaml from "js-yaml";
import { EntitySchema, DualityViewSchema, type Entity, type DualityView } from "./schemas";

export function parseEntity(input: string): Entity {
  return EntitySchema.parse(yaml.load(input));
}

export function stringifyEntity(entity: Entity): string {
  return yaml.dump(EntitySchema.parse(entity), { lineWidth: 100, noRefs: true });
}

export function parseView(input: string): DualityView {
  return DualityViewSchema.parse(yaml.load(input));
}

export function stringifyView(view: DualityView): string {
  return yaml.dump(DualityViewSchema.parse(view), { lineWidth: 100, noRefs: true });
}
